import { test, expect, loginAdmin, pick, optionsOf, docLine, ymd } from './inventory-ui.js';

// BROWSER-CHECKS §4 (P1-P4, P6-P8, P10-P12): Ingreso. The draft lives in localStorage, so every test
// (a fresh browser context) starts on an empty document. Each test owns its items and provider.
test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

const open = (page) => page.goto('/dashboard/inventory/ingreso');
const confirmButton = (page) => page.getByRole('button', { name: /^Confirmar ingreso/ });
const qtyBox = (page, name) => page.getByLabel(`Cantidad de ${name}`);
const totalBox = (page, name) => page.getByLabel(`Total pagado por ${name}`);
const purchases = async (inv, item) => (await inv.movements(item)).filter((m) => m.type === 'purchase');

test('P1 a provider can be created inline and the document stays open', async ({ page }) => {
  const name = `e2e prov ${Date.now().toString(36)}`;
  await open(page);
  await page.getByRole('combobox', { name: 'Proveedor', exact: true }).fill(name);
  await page.getByRole('option').filter({ hasText: 'Crear' }).click();
  await expect(page.locator('.ui-item-filled').filter({ hasText: name })).toBeVisible();
  await expect(page.getByText('sin compras anteriores')).toBeVisible();
  await expect(page.getByText('Este ingreso no tiene líneas')).toBeVisible();
});

test('P2 a provider with history prefills the basket; P3 a different price is flagged', async ({ page, inv }) => {
  const flour = await inv.ingredient({ cost: 10 });
  const provider = await inv.provider();
  await inv.purchase({ provider, lines: [{ item: flour, qty: 10, total: 100 }] });

  await open(page);
  await pick(page, 'Proveedor', provider.name);
  const line = docLine(page, flour.name);
  await expect(line).toBeVisible();
  await expect(qtyBox(page, flour.name)).toHaveValue('10');
  await expect(line).toContainText('precio anterior'); // an estimate: no flag yet
  await expect(line).not.toContainText(/subió|bajó/);

  await totalBox(page, flour.name).fill('120'); // 12 per unit against 10
  await expect(line).toContainText('subió 20%');
  await totalBox(page, flour.name).fill('80');
  await expect(line).toContainText('bajó 20%');
});

test('P2 a provider picked after lines exist, or with no history, adds nothing', async ({ page, inv }) => {
  const flour = await inv.ingredient({ cost: 10 });
  const other = await inv.ingredient({ cost: 10 });
  const provider = await inv.provider();
  const empty = await inv.provider(); // the provider list is read once, on load
  await inv.purchase({ provider, lines: [{ item: flour, qty: 10, total: 100 }] });

  await open(page);
  await pick(page, 'Agregar artículo', other.name);
  await pick(page, 'Proveedor', provider.name);
  await expect(page.getByText('con los precios de su última compra')).toBeVisible();
  await expect(docLine(page, other.name)).toBeVisible();
  await expect(docLine(page, flour.name)).toHaveCount(0);

  await page.getByRole('button', { name: 'Cambiar proveedor' }).click();
  await pick(page, 'Proveedor', empty.name);
  await expect(page.getByText('sin compras anteriores')).toBeVisible();
  await expect(page.locator('.ui-item-filled').filter({ hasText: 'precio anterior' })).toHaveCount(0);
});

test('P4 the picker offers ingredients and resale products, never what you make', async ({ page, inv }) => {
  const ingredient = await inv.ingredient();
  const resale = await inv.product({ mode: 'unit' });
  const made = await inv.product({ mode: 'recipe' });

  await open(page);
  const search = page.getByRole('combobox', { name: 'Agregar artículo', exact: true });
  await search.fill(ingredient.name);
  await expect(optionsOf(page, ingredient.name)).toHaveCount(1);
  await search.fill(resale.name);
  await expect(optionsOf(page, resale.name)).toHaveCount(1);
  await search.fill(made.name);
  await expect(optionsOf(page, made.name)).toHaveCount(0); // only "Crear …"
  await search.fill('masa base'); // a seeded preparación
  await expect(page.getByRole('option').filter({ hasText: /^Masa Base/i })).toHaveCount(0);
});

test('P6 the cost box is ticked by default and unticking keeps the old cost; P7 confirming re-costs', async ({ page, inv }) => {
  const flour = await inv.ingredient({ cost: 5 });
  const kept = await inv.ingredient({ cost: 5 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });
  const productBefore = (await inv.call('GET', `/products/${product.id}`)).costPrice;
  const provider = await inv.provider();

  await open(page);
  await pick(page, 'Proveedor', provider.name);
  for (const item of [flour, kept]) {
    await pick(page, 'Agregar artículo', item.name);
    await qtyBox(page, item.name).fill('10');
    await totalBox(page, item.name).fill('100'); // 10 per unit against 5
  }
  const tick = (item) => page.getByLabel(`Actualizar el costo de ${item.name}`);
  await expect(tick(flour)).toBeChecked();
  await expect(tick(kept)).toBeChecked();
  await expect(confirmButton(page)).toContainText('actualiza 2 costos');

  await tick(kept).uncheck();
  await expect(confirmButton(page)).toContainText('actualiza 1 costo');
  await confirmButton(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar ingreso' }).click();
  await expect(page.getByText('Ingreso registrado: 2 línea(s).')).toBeVisible();

  expect((await inv.stock(flour)).currentStock).toBe(10);
  expect((await inv.stock(kept)).currentStock).toBe(10);
  await expect.poll(async () => (await inv.call('GET', `/ingredients/${flour.id}`)).costPerUnit).toBe(10);
  expect((await inv.call('GET', `/ingredients/${kept.id}`)).costPerUnit).toBe(5); // unticked: untouched
  await expect.poll(async () => (await inv.call('GET', `/products/${product.id}`)).costPrice).toBeCloseTo(productBefore * 2);
});

test('P8 a double click on Confirmar makes one purchase', async ({ page, inv }) => {
  const flour = await inv.ingredient({ cost: 5 });
  const provider = await inv.provider();

  await open(page);
  await pick(page, 'Proveedor', provider.name);
  await pick(page, 'Agregar artículo', flour.name);
  await qtyBox(page, flour.name).fill('10');
  await totalBox(page, flour.name).fill('50'); // the stored cost: no dialog
  await confirmButton(page).dblclick();
  await expect(page.getByText('Ingreso registrado: 1 línea(s).')).toBeVisible();

  expect(await purchases(inv, flour)).toHaveLength(1);
  expect((await inv.stock(flour)).currentStock).toBe(10);
});

test('P10 Confirmar needs a provider and a positive quantity on every line', async ({ page, inv }) => {
  const flour = await inv.ingredient({ cost: 5 });
  const provider = await inv.provider();

  await open(page);
  await pick(page, 'Agregar artículo', flour.name);
  await totalBox(page, flour.name).fill('50');
  await expect(confirmButton(page)).toBeDisabled(); // no provider
  await expect(page.getByText('Elige el proveedor para poder confirmar.')).toBeVisible();

  await pick(page, 'Proveedor', provider.name);
  await expect(confirmButton(page)).toBeEnabled();
  for (const qty of ['0', '', '-2']) {
    await qtyBox(page, flour.name).fill(qty);
    await expect(confirmButton(page)).toBeDisabled();
  }
  await qtyBox(page, flour.name).fill('3');
  await expect(confirmButton(page)).toBeEnabled();
});

test('P11 the draft survives a reload; P12 a new document is dated today', async ({ page, inv }) => {
  const flour = await inv.ingredient({ cost: 5 });
  const provider = await inv.provider();
  const date = page.getByLabel('Fecha');

  await open(page);
  await expect(date).toHaveValue(ymd(new Date())); // local today, not the UTC day
  await pick(page, 'Proveedor', provider.name);
  await pick(page, 'Agregar artículo', flour.name);
  await qtyBox(page, flour.name).fill('7');
  await date.fill('2040-03-04'); // an invoice date can be in the past (or anywhere)

  await page.reload();
  await expect(qtyBox(page, flour.name)).toHaveValue('7');
  await expect(page.locator('.ui-item-filled').filter({ hasText: provider.name })).toBeVisible();
  await expect(date).toHaveValue('2040-03-04'); // a restored draft keeps its own date
});
