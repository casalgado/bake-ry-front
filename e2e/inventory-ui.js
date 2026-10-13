import { test as base, expect } from '@playwright/test';
import { login } from './helpers.js';
import { api, firestore, INVENTORY_ADMIN } from './inventory-api.js';

export { expect };

// `inv`: arrange helpers, with the test's orders soft-deleted afterwards.
// `page`: fails the test on an uncaught error or a Firestore `permission-denied` (the manual doc's
// "console stays quiet" line, applied to every test).
export const test = base.extend({
  inv: async ({ request }, use) => {
    const inv = await api(request);
    await use(inv);
    await inv.cleanup();
  },
  // `fs`: Firestore REST (emulator): gaps and writes that skip the API.
  fs: async ({ request }, use) => use(firestore(request)),
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && /permission-denied/i.test(m.text())) problems.push(m.text());
    });
    await use(page);
    expect(problems, 'console problems').toEqual([]);
  },
});

export const loginAdmin = async (page, credentials = INVENTORY_ADMIN) => {
  await login(page, credentials);
  await expect(page).toHaveURL(/\/dashboard/);
};

// ---- days and the orders list (own copies: the orders suite owns its helpers and changes them) ----

let dayCounter = 0;

// A distinct day per call (noon local) in 2040, so an order never shares its list with real or orders-suite data.
export const uniqueDay = () => {
  const base = new Date(2040, 0, 1, 12);
  base.setDate(base.getDate() + (Math.floor(Date.now() / 60000) % 3000) + ++dayCounter);
  return base;
};

export const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const rowOf = (page, text) => page.getByRole('row').filter({ hasText: text });

// The period selector can't reach 2040, so the period store is set directly after the page mounts.
// Waits for the page's first orders fetch: changing the period while it is in flight leaves the table loading.
export const openOnDay = async (page, path, date) => {
  const firstFetch = page.waitForResponse((r) => /\/orders(\/\w+)?\?/.test(r.url()));
  await page.goto(path);
  await firstFetch;
  await page.waitForFunction(() =>
    document.getElementById('app')?.__vue_app__?.config.globalProperties.$pinia.state.value.period);
  await page.evaluate((iso) => {
    const pinia = document.getElementById('app').__vue_app__.config.globalProperties.$pinia;
    pinia.state.value.period.periodType = 'day';
    pinia.state.value.period.currentDate = new Date(iso);
  }, date.toISOString());
};

// ---- order form (old Tailwind view: no test ids, so lines are found by structure) ----

// Search mode: exactly one match is added with quantity 1.
export const addProduct = async (page, query) => {
  const search = page.locator('#pos-product-search-input');
  if (!(await search.isVisible())) await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await search.fill(query);
};

// The header row of a line (collection, product name, stock chip). `.nth(i)` for repeated products.
export const lineOf = (page, text) =>
  page.locator('div.flex.items-center.justify-between.gap-2').filter({ hasText: text });

// Quantity boxes are the only number inputs with min=1 step=1, in line order.
export const setQuantity = (page, index, qty) =>
  page.locator('input[type=number][min="1"][step="1"]').nth(index).fill(String(qty));

export const expectRed = (line, red = true) => expect(line.locator('.text-red-700')).toHaveCount(red ? 1 : 0);

export const pickClient = async (page, name) => {
  await page.getByRole('combobox').fill(name);
  await page.getByRole('option', { name }).click();
};

// Fills the rest of a new order (client, day, pickup) and saves it.
export const saveNewOrder = async (page, client, day) => {
  await pickClient(page, client.name);
  await page.locator('#preparation-date').fill(day);
  await page.getByText('Recoger', { exact: true }).click();
  await page.getByRole('button', { name: 'Crear Pedido' }).click();
};

// The Ingreso / Producción picker: type, then click the row. `label` is the combobox's aria-label.
// The catalog loads after the page: until it has, only "Crear <name>" matches, so that row is excluded.
export const optionsOf = (page, name) =>
  page.getByRole('option').filter({ hasText: name }).filter({ hasNotText: 'Crear' });

export const pick = async (page, label, name) => {
  await page.getByRole('combobox', { name: label, exact: true }).fill(name);
  await optionsOf(page, name).first().click();
  // Folds the list: left open, it collapses on the next mousedown and moves the button the click was aimed at.
  await page.keyboard.press('Escape'); // (the provider picker is gone by now, so no locator)
};

// A document line (Ingreso / Producción) by item name.
export const docLine = (page, name) => page.locator('.ui-item-filled').filter({ hasText: name });

// Same formatting as formatQty in src/utils/helpers.js.
const fmt = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 3 });
const re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Existencias with one item selected. Navigate after arranging data: the list is fetched on load.
export const openStock = async (page, name) => {
  await page.goto('/dashboard/inventory');
  await page.getByRole('searchbox', { name: 'Buscar artículo' }).fill(name);
  const row = page.locator('button.ui-item').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await row.click();
  return {
    row,
    existencia: page.locator('.ui-stat-hero').filter({ hasText: 'Existencia' }).locator('.ui-stat-v'),
    stat: (label) => page.locator('.ui-stat').filter({ hasText: label }),
    history: page.locator('.ui-item-divided'),
  };
};

// The number at the end of the list row. `(?![\d,.])` keeps "10" from matching "100".
export const expectRowQty = (row, qty) =>
  expect(row.locator('.ui-item-num')).toHaveText(new RegExp(`^${re(fmt(qty))}(?![\\d,.])`));

export const expectExistencia = (stock, qty) =>
  expect(stock.existencia).toHaveText(new RegExp(`^${re(fmt(qty))}(?![\\d,.])`));

// Sum of the qty column of a movement list, by type: [{ type, qty }]. The ledger as the API tells it.
export const net = (movements, type) =>
  movements.filter((m) => !type || m.type === type).reduce((sum, m) => sum + m.qty, 0);
