import { test, expect, loginAdmin, openOnDay, rowOf, uniqueDay } from './inventory-ui.js';

// BROWSER-CHECKS §6 (K1, K3-K5, K9): the kitchen lists. Each test owns a day (2040) and its products, so
// the table holds only its own rows. Roles (K12-K14) live in the roles spec.
test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

const SINGLE = '/dashboard/orders/production/single';
const GROUPED = '/dashboard/orders/production/grouped';
const estado = (row) => row.getByRole('cell').last();
const button = (page, name) => page.getByRole('button', { name, exact: true });
const dialog = (page) => page.getByRole('dialog');
const label = (qty, name) => new RegExp(`${qty} .*${name}`, 'i');

// A recipe product (100 g of its own flour per unit) with one Vitrina run line of `plannedQty` on `day`.
const vitrina = async (inv, day, plannedQty = 3) => {
  const flour = await inv.ingredient({ stock: 1000 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });
  await inv.run({ date: day.toISOString(), lines: [{ item: product, plannedQty }] });
  return { flour, product };
};

test('K1 order lines show the customer, Vitrina lines say Vitrina, Disponible lines never appear', async ({ page, inv }) => {
  const day = uniqueDay();
  const client = await inv.client();
  const made = await inv.product({ mode: 'recipe' });
  const shelf = await inv.product({ mode: 'recipe', stock: 10 });
  const batch = await inv.product({ mode: 'recipe' });
  await inv.order({
    client,
    day,
    internalNotes: 'sin sal',
    lines: [{ product: made, quantity: 2, source: 'produce' }, { product: shelf, quantity: 1, source: 'stock' }],
  });
  await inv.run({ date: day.toISOString(), lines: [{ item: batch, plannedQty: 4 }] });

  await openOnDay(page, SINGLE, day);
  const orderRow = rowOf(page, made.name);
  await expect(orderRow).toContainText(client.name);
  await expect(orderRow).toContainText('sin sal');
  const vitrinaRow = rowOf(page, batch.name);
  await expect(vitrinaRow).toContainText('Vitrina');
  await expect(vitrinaRow).not.toContainText('sin sal');
  await expect(rowOf(page, shelf.name)).toHaveCount(0); // the table has loaded: the two rows above are there
});

test('K3 ticking a Vitrina row asks first, then books the run and locks the row; cancel moves nothing', async ({ page, inv }) => {
  const day = uniqueDay();
  const { flour, product } = await vitrina(inv, day, 3);

  await openOnDay(page, SINGLE, day);
  const row = rowOf(page, product.name);
  await estado(row).click();
  await expect(dialog(page)).toContainText('Confirmar producción');
  await expect(dialog(page)).toContainText(label(3, product.name));
  await button(page, 'Cancelar').click();
  await expect(dialog(page)).toHaveCount(0);
  expect((await inv.stock(product)).currentStock).toBe(0);
  await expect(row).not.toContainText(/producido/i);

  await estado(row).click();
  await button(page, 'Marcar producido').click();
  await expect(row).toContainText(/producido/i);
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(3);
  expect((await inv.stock(flour)).currentStock).toBe(700); // 3 × 100 g, as the Producción preview said

  await estado(row).click(); // locked: it moved stock, so it does not un-tick
  await expect(dialog(page)).toHaveCount(0);
  await expect(row).toContainText(/producido/i);
  expect((await inv.stock(product)).currentStock).toBe(3);
});

test('K3 ticking a mix of rows marks the order rows and asks only for the pending Vitrina one', async ({ page, inv }) => {
  const day = uniqueDay();
  const { product } = await vitrina(inv, day, 2);
  const orderProduct = await inv.product({ mode: 'recipe' });
  const client = await inv.client();
  const order = await inv.order({ client, day, lines: [{ product: orderProduct, quantity: 1, source: 'produce' }] });

  await openOnDay(page, SINGLE, day);
  await rowOf(page, product.name).click();
  await rowOf(page, orderProduct.name).click();
  await estado(rowOf(page, product.name)).click();

  await expect(dialog(page)).toContainText(label(2, product.name));
  await expect(dialog(page)).not.toContainText(new RegExp(orderProduct.name, 'i'));
  await expect.poll(async () => (await inv.getOrder(order)).orderItems[0].status).toBe(1); // marked right away
  await button(page, 'Marcar producido').click();
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(2);
});

test('K4 undoing a produced Vitrina row gives the stock back; ticking again produces again', async ({ page, inv }) => {
  const day = uniqueDay();
  const { flour, product } = await vitrina(inv, day, 3);

  await openOnDay(page, SINGLE, day);
  const row = rowOf(page, product.name);
  await estado(row).click();
  await button(page, 'Marcar producido').click();
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(3);

  await row.click(); // select it
  await button(page, 'Deshacer producido').click();
  await expect(dialog(page)).toContainText('La bodega se revierte');
  await button(page, 'Deshacer').click();
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(0);
  expect((await inv.stock(flour)).currentStock).toBe(1000);
  await expect(row).not.toContainText(/producido/i);

  await estado(row).click();
  await button(page, 'Marcar producido').click();
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(3);
  expect((await inv.stock(flour)).currentStock).toBe(700);
});

test('K4 undoing an order row only clears the mark', async ({ page, inv }) => {
  const day = uniqueDay();
  const product = await inv.product({ mode: 'recipe' });
  const order = await inv.order({ client: await inv.client(), day, lines: [{ product, quantity: 1, source: 'produce' }] });

  await openOnDay(page, SINGLE, day);
  const row = rowOf(page, product.name);
  await estado(row).click();
  await expect(row).toContainText(/producido/i);
  await row.click();
  await button(page, 'Deshacer producido').click();
  await expect(dialog(page)).toContainText('Vuelve a pendiente.');
  await button(page, 'Deshacer').click();
  await expect.poll(async () => (await inv.getOrder(order)).orderItems[0].status).toBe(0);
});

test('K5 a pending Vitrina row can be edited, then receiving books the new number', async ({ page, inv }) => {
  const day = uniqueDay();
  const { product } = await vitrina(inv, day, 3);

  await openOnDay(page, SINGLE, day);
  const row = rowOf(page, product.name);
  await row.click();
  await button(page, 'Editar cantidad').click();
  await dialog(page).getByRole('spinbutton').fill('3'); // the same number is refused
  await button(page, 'Guardar').click();
  await expect(dialog(page)).toContainText('distinta de la actual');
  await dialog(page).getByRole('spinbutton').fill('5');
  await button(page, 'Guardar').click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(row).toContainText(label(5, product.name));
  expect((await inv.stock(product)).incoming).toBe(5);

  await estado(row).click();
  await button(page, 'Marcar producido').click();
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(5);

  await row.click(); // produced: neither action is offered
  await expect(button(page, 'Deshacer producido')).toBeVisible();
  await expect(button(page, 'Editar cantidad')).toHaveCount(0);
  await expect(button(page, 'Quitar de producción')).toHaveCount(0);
});

test('K5 removing a pending Vitrina row drops it and its En producción', async ({ page, inv }) => {
  const day = uniqueDay();
  const { product } = await vitrina(inv, day, 3);
  expect((await inv.stock(product)).incoming).toBe(3);

  await openOnDay(page, SINGLE, day);
  const row = rowOf(page, product.name);
  await row.click();
  await button(page, 'Quitar de producción').click();
  await expect(dialog(page)).toContainText('La bodega no cambia');
  await button(page, 'Quitar').click();
  await expect(row).toHaveCount(0);
  await expect.poll(async () => (await inv.stock(product)).incoming).toBe(0);
  expect((await inv.stock(product)).currentStock).toBe(0);
});

test('K9 in the grouped list the Estado column cannot be clicked', async ({ page, inv }) => {
  const day = uniqueDay();
  const product = await inv.product({ mode: 'recipe' });
  const order = await inv.order({ client: await inv.client(), day, lines: [{ product, quantity: 2, source: 'produce' }] });

  await openOnDay(page, GROUPED, day);
  const row = rowOf(page, product.name);
  await expect(row).toBeVisible();
  await estado(row).click();
  await page.waitForTimeout(1500); // a toggle would have written by now
  expect((await inv.getOrder(order)).orderItems[0].status).toBe(0);
});
