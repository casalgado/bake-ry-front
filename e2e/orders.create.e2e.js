import { test, expect } from '@playwright/test';
import { inDays, uniqueNote, ymd } from './orders-api.js';

const DAY = 1; // tomorrow
import { loginAdmin, openOn, money, rowOf } from './orders-ui.js';

test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

// Search mode: one match is added with quantity 1, several open a dropdown.
const addProduct = async (page, query, option) => {
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  const search = page.locator('#pos-product-search-input');
  await search.fill(query);
  if (option) await page.getByText(option, { exact: true }).click();
};

const pickClient = async (page, name) => {
  await page.getByRole('combobox').fill(name);
  await page.getByRole('option', { name }).click();
};

test('a pickup order shows on its day, with the right total, and not on the next', async ({ page }) => {
  const note = uniqueNote();

  await page.goto('/dashboard/orders/create');
  await pickClient(page, 'Cliente Persona');
  await page.locator('#preparation-date').fill(ymd(inDays(DAY)));
  await page.getByText('Recoger', { exact: true }).click();
  await addProduct(page, 'pan campesino');
  await addProduct(page, 'croissant', 'croissant (Grande)');
  await page.locator('#internal-notes').fill(note);
  const created = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/orders'));
  await page.getByRole('button', { name: 'Crear Pedido' }).click();
  expect((await created).ok()).toBe(true);

  await openOn(page, '/dashboard/orders', { days: DAY });
  await expect(rowOf(page, note)).toContainText(money(10000 + 7000));

  // Not on the day after: the table has to be done loading for an absence to mean anything.
  await openOn(page, '/dashboard/orders', { days: DAY + 1 });
  await expect(page.locator('tbody.opacity-20')).toHaveCount(0);
  await expect(rowOf(page, note)).toHaveCount(0);
});

test('submitting without a client is rejected', async ({ page }) => {
  await page.goto('/dashboard/orders/create');
  await page.getByRole('button', { name: 'Crear Pedido' }).click();
  await expect(page.locator('.text-danger', { hasText: 'Cliente es requerido' })).toBeVisible();
});
