import { test, expect, loginAdmin, pick, docLine, openStock, ymd } from './inventory-ui.js';
import { BAKERY } from './inventory-api.js';

// BROWSER-CHECKS §5 (R1-R7): Producción. The draft lives in localStorage, so every test starts on an empty
// document. Each test owns its items; "Masa Base" (seeded, yield 5000 g, already stocked) is only read.
test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

const open = (page) => page.goto('/dashboard/inventory/produccion');
const qtyBox = (page, name) => docLine(page, name).locator('input[aria-label^="Cantidad de"]');
const batchBox = (page, name) => docLine(page, name).locator('input[aria-label^="Tandas de"]');
const send = (page) => page.getByRole('button', { name: /^Enviar a producción|^Enviando/ });
const consumes = (page, name) => page.locator('.ui-item-divided').filter({ hasText: name });
const runsOf = async (inv, product) =>
  (await inv.runs()).items.filter((run) => run.lines.some((l) => l.item.id === product.id));

test('R1 the picker offers what you make, flags untracked ones, and never a resale product', async ({ page, inv }) => {
  const made = await inv.product({ mode: 'recipe' });
  const untracked = await inv.product({ mode: 'none' });
  const resale = await inv.product({ mode: 'unit' });

  await open(page);
  const search = page.getByRole('combobox', { name: 'Agregar artículo', exact: true });
  await search.fill(made.name);
  await expect(page.getByRole('option').filter({ hasText: made.name })).toHaveCount(1);
  await expect(page.getByRole('option').filter({ hasText: made.name })).not.toContainText('se activará el inventario');
  await search.fill(untracked.name);
  await expect(page.getByRole('option').filter({ hasText: untracked.name })).toContainText('se activará el inventario');
  await search.fill(resale.name);
  await expect(page.getByRole('option').filter({ hasText: resale.name })).toHaveCount(0);
  await search.fill('masa base');
  await expect(page.getByRole('option').filter({ hasText: /masa base/i })).toHaveCount(1); // a preparación
});

test('R2 adding an untracked product switches its inventory on, once, even when picked twice', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'none' });

  await open(page);
  await pick(page, 'Agregar artículo', product.name);
  await pick(page, 'Agregar artículo', product.name);
  await expect(docLine(page, product.name)).toHaveCount(1);
  await expect(qtyBox(page, product.name)).toHaveValue('2'); // the second pick bumped the first line
  await expect(page.locator('.ui-field-error')).toHaveCount(0);

  await expect.poll(async () => (await inv.call('GET', `/products/${product.id}`)).inventoryMode).toBe('recipe');
  await expect.poll(async () => (await inv.stock(product))?.currentStock).toBe(0); // a stocks row now exists
  await openStock(page, product.name);
});

test('R3 lotes turn into the quantity and survive odd typing; products have no lotes box', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe' });

  await open(page);
  await pick(page, 'Agregar artículo', 'masa base');
  const batches = batchBox(page, 'masa base');
  await expect(qtyBox(page, 'masa base')).toHaveValue('5000'); // one tanda
  await expect(batches).toHaveValue('1');

  await batches.fill('2');
  await expect(qtyBox(page, 'masa base')).toHaveValue('10000');

  // Typed one key at a time: neither the 0 nor the dot may be eaten (a number box reads "1." as '').
  await batches.fill('');
  await batches.pressSequentially('0');
  await expect(batches).toHaveValue('0');
  await batches.fill('');
  await batches.pressSequentially('1.5');
  await expect(batches).toHaveValue('1.5');
  await expect(qtyBox(page, 'masa base')).toHaveValue('7500');
  await batches.fill('');
  await batches.pressSequentially('.5');
  await expect(batches).toHaveValue('.5');
  await expect(qtyBox(page, 'masa base')).toHaveValue('2500');
  await batches.blur();
  await expect(batches).toHaveValue('0.5'); // normalised on blur

  await pick(page, 'Agregar artículo', product.name);
  await expect(batchBox(page, product.name)).toHaveCount(0);
});

test('R4 the preview sums components, flags shortfalls and gaps, and follows the last quantity', async ({ page, inv }) => {
  const flour = await inv.ingredient({ stock: 250 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });
  const noRecipe = await inv.product({ mode: 'recipe' });

  await open(page);
  await pick(page, 'Agregar artículo', product.name);
  await qtyBox(page, product.name).fill('2');
  await qtyBox(page, product.name).fill('3');
  await qtyBox(page, product.name).fill('4'); // 400 g of 250: short, and the last number wins
  await expect(consumes(page, flour.name)).toContainText('400');
  await expect(consumes(page, flour.name)).toContainText('hay 250');
  await expect(consumes(page, flour.name)).toContainText('no alcanza');

  await qtyBox(page, product.name).fill('2');
  await expect(consumes(page, flour.name)).toContainText('200');
  await expect(consumes(page, flour.name)).not.toContainText('no alcanza');

  await pick(page, 'Agregar artículo', noRecipe.name);
  await expect(page.getByText('sin receta — no descuenta nada')).toBeVisible();
  await expect(docLine(page, noRecipe.name).getByRole('img', { name: 'Este producto no tiene receta' })).toBeVisible();
});

test('R4 a failed preview clears the old one and shows an error', async ({ page, inv }) => {
  const flour = await inv.ingredient({ stock: 1000 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });

  await open(page);
  await pick(page, 'Agregar artículo', product.name);
  await expect(consumes(page, flour.name)).toContainText('100');

  await page.route(/productionRuns\/preview/, (route) => route.abort());
  await qtyBox(page, product.name).fill('5');
  await expect(page.locator('.ui-field-error')).toBeVisible();
  await expect(consumes(page, flour.name)).toHaveCount(0); // no stale figure
});

test('R5 Enviar creates one run: En producción rises, existencia does not, and the draft is cleared', async ({ page, inv }) => {
  const flour = await inv.ingredient({ stock: 1000 });
  const product = await inv.product({ mode: 'recipe', stock: 3, recipe: [{ ingredient: flour, quantity: 100 }] });

  await open(page);
  await pick(page, 'Agregar artículo', product.name);
  await qtyBox(page, product.name).fill('4');
  await send(page).dblclick();
  await expect(page.getByText('Enviado a producción: 1 línea(s).')).toBeVisible();
  await expect(docLine(page, product.name)).toHaveCount(0);

  expect(await runsOf(inv, product)).toHaveLength(1);
  const stock = await inv.stock(product);
  expect(stock.currentStock).toBe(3);
  expect(stock.incoming).toBe(4);
  const view = await openStock(page, product.name);
  await expect(view.stat('En producción')).toContainText('4');
  await expect(view.existencia).toHaveText(/^3(?![\d,.])/);
  expect((await inv.stock({ ...flour })).currentStock).toBe(1000); // nothing consumed until the kitchen receives
});

test('R5 a failed send keeps the draft; the retry makes one run', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe' });

  await open(page);
  await pick(page, 'Agregar artículo', product.name);
  let failing = true;
  await page.route('**/productionRuns', (route) =>
    (failing && route.request().method() === 'POST' ? route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, json: { message: 'boom' } }) : route.continue()));
  await send(page).click();
  await expect(page.locator('.ui-field-error')).toBeVisible();
  await expect(docLine(page, product.name)).toHaveCount(1);

  failing = false;
  await send(page).click();
  await expect(page.getByText('Enviado a producción: 1 línea(s).')).toBeVisible();
  expect(await runsOf(inv, product)).toHaveLength(1);
});

test('R6 Repetir brings back the last production once', async ({ page, inv }) => {
  const flour = await inv.ingredient({ stock: 1000 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0);
  await inv.run({ date: yesterday.toISOString(), lines: [{ item: product, plannedQty: 6 }] });

  await open(page);
  await page.getByRole('button', { name: /^Repetir la producción del/ }).click();
  await expect(qtyBox(page, product.name)).toHaveValue('6');
  await page.getByRole('button', { name: /^Repetir la producción del/ }).click(); // a second press adds nothing
  await expect(docLine(page, product.name)).toHaveCount(1);
  await expect(qtyBox(page, product.name)).toHaveValue('6');
});

test('R7 a draft restored from an earlier day moves to today', async ({ page }) => {
  await page.evaluate((key) => {
    const doc = { kind: 'produccion', date: '2020-01-02', warehouseId: null, lines: [], idempotencyKey: 'k' };
    localStorage.setItem(key, JSON.stringify({ produccion: doc }));
  }, `inventoryDocs.${BAKERY}`);

  await open(page);
  await expect(page.getByLabel('Fecha')).toHaveValue(ymd(new Date()));
});
