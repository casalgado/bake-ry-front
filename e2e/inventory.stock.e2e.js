import { test, expect, loginAdmin, openStock, expectRowQty, expectExistencia, net } from './inventory-ui.js';

// BROWSER-CHECKS §3 (E1-E5, E8): the Existencias screen. Each test owns its item, so the numbers are exact.
test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

const form = (page) => page.locator('form.ui-card');
const submit = (page) => form(page).getByRole('button', { name: /^(Registrar|Guardar)$/ });

test('E1 the row and the pane show the available figure only when orders move it', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });
  const order = await inv.order({ client: await inv.client(), lines: [{ product, quantity: 4, source: 'stock' }] });

  let stock = await openStock(page, product.name);
  expectRowQty(stock.row, 10);
  await expect(stock.row).toContainText('disp. 6');
  await expectExistencia(stock, 10);
  await expect(stock.stat('Disponible')).toContainText('6');
  await expect(stock.stat('Comprometido')).toContainText('4');
  await expect(stock.stat('En producción')).toHaveCount(0);

  await inv.removeOrder(order); // nothing committed any more: the extra line and the stats go
  stock = await openStock(page, product.name);
  await expect(stock.row).not.toContainText('disp.');
  await expect(stock.stat('Disponible')).toHaveCount(0);
  await expect(stock.stat('Comprometido')).toHaveCount(0);
});

test('E2 Ajustar moves the number and writes one adjustment; bad input writes nothing', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'unit' });
  const stock = await openStock(page, product.name);
  await page.getByRole('button', { name: 'Ajustar' }).click();

  // No reason: the browser's required check stops the submit.
  await form(page).getByLabel('Cantidad').fill('5');
  await submit(page).click();
  await expect(form(page)).toBeVisible();
  // Quantity 0 and blank.
  await form(page).getByLabel('Motivo').fill('conteo inicial');
  for (const qty of ['0', '']) {
    await form(page).getByLabel('Cantidad').fill(qty);
    await submit(page).click();
    await expect(form(page)).toContainText('Escribe una cantidad.');
  }
  expect(await inv.movements(product)).toEqual([]);

  // A real one, double-clicked: one movement.
  await form(page).getByLabel('Cantidad').fill('10');
  await submit(page).dblclick();
  await expect(form(page)).toHaveCount(0);
  await expectExistencia(stock, 10);
  await expectRowQty(stock.row, 10);
  await expect(stock.history).toHaveCount(1);
  await expect(stock.history).toContainText('Ajustes');
  await expect(stock.history).toContainText('conteo inicial');
  expect((await inv.movements(product)).map((m) => [m.type, m.qty])).toEqual([['adjustment', 10]]);
});

test('E3 Baja is stored negative and shows apart from an adjustment', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'unit', stock: 10 });
  const stock = await openStock(page, product.name);

  await page.getByRole('button', { name: 'Registrar baja' }).click();
  await form(page).getByLabel('Cantidad').fill('-2');
  await submit(page).click();
  await expect(form(page)).toContainText('La cantidad debe ser positiva.');

  await form(page).getByLabel('Cantidad').fill('3');
  await form(page).getByLabel('Motivo').selectOption('Vencido');
  await submit(page).click();
  await expect(form(page)).toHaveCount(0);

  await expectExistencia(stock, 7);
  const waste = stock.history.filter({ hasText: 'Bajas' });
  await expect(waste).toHaveCount(1);
  await expect(waste).toContainText('Vencido');
  await expect(stock.history.filter({ hasText: 'Ajustes' })).toHaveCount(1); // the setup adjustment, a different label
  const movements = await inv.movements(product);
  expect(net(movements, 'waste')).toBe(-3);
  expect(new Set(movements.map((m) => m.type))).toEqual(new Set(['adjustment', 'waste']));
});

test('E4 editing an ingredient cost previews what it moves, then re-costs the recipe product', async ({ page, inv }) => {
  const flour = await inv.ingredient({ cost: 5, stock: 100 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });
  const before = (await inv.call('GET', `/products/${product.id}`)).costPrice;
  expect(before).toBeGreaterThan(0);

  await openStock(page, flour.name);
  await page.getByRole('button', { name: 'Editar costo' }).click();
  const cost = form(page).getByLabel(/^Costo por/);

  // The same number: nothing to preview.
  await cost.fill('5');
  await page.waitForTimeout(1200); // the preview is debounced 0.5 s
  await expect(form(page)).not.toContainText(/Cambia|No mueve/);

  // Typing on: the preview ends on the last number.
  await cost.fill('7');
  await cost.fill('9');
  await expect(form(page)).toContainText('Cambia 1 costo');
  await expect(form(page)).toContainText(product.name);

  await submit(page).click();
  await expect(form(page)).toHaveCount(0);
  expect((await inv.call('GET', `/ingredients/${flour.id}`)).costPerUnit).toBe(9);
  await expect.poll(async () => (await inv.call('GET', `/products/${product.id}`)).costPrice).toBeCloseTo((before * 9) / 5);
});

test('E5 the cost action is offered only where the cost is typed by hand', async ({ page, inv }) => {
  const ingredient = await inv.ingredient({ stock: 10 });
  const resale = await inv.product({ mode: 'unit', stock: 1 });
  const flour = await inv.ingredient({ stock: 100 });
  const recipeProduct = await inv.product({ mode: 'recipe', stock: 1, recipe: [{ ingredient: flour, quantity: 10 }] });
  const action = page.getByRole('button', { name: 'Editar costo' });

  await openStock(page, ingredient.name);
  await expect(action).toBeVisible();
  await openStock(page, resale.name);
  await expect(action).toBeVisible();
  await openStock(page, recipeProduct.name);
  await expect(action).toHaveCount(0);
  await openStock(page, 'masa base'); // seeded preparación: its cost is its recipe's
  await expect(action).toHaveCount(0);
});

test('E8 an untracked product never appears, and a search with no match says so', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'none' });
  await page.goto('/dashboard/inventory');
  await page.getByRole('searchbox', { name: 'Buscar artículo' }).fill(product.name);
  await expect(page.getByText('Nada coincide con esa búsqueda.')).toBeVisible();
  await expect(page.locator('button.ui-item')).toHaveCount(0);
});
