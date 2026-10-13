import { test, expect, loginAdmin, openStock, expectRowQty, expectExistencia, net } from './inventory-ui.js';

// BROWSER-CHECKS §2 (S1-S6, S11). Orders move through the API (the same endpoints the tables call);
// the ledger is read from the API and the numbers are checked on Existencias.
// Every test uses its own items, so the assertions are exact.
test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

const qtyOf = (inv, item) => async () => (await inv.stock(item))?.currentStock;

test('S1 a Disponible line: committed, ship, move back, ship again, deliver, edit, delete', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });
  const client = await inv.client();
  const poll = (n) => expect.poll(qtyOf(inv, product)).toBe(n);

  // 1. Recibida: stock untouched, the 4 are only committed.
  const order = await inv.order({ client, lines: [{ product, quantity: 4, source: 'stock' }] });
  const row = await inv.stock(product);
  expect(row).toMatchObject({ currentStock: 10, committed: 4, available: 6 });
  let stock = await openStock(page, product.name);
  await expectExistencia(stock, 10);
  await expect(stock.stat('Disponible')).toContainText('6');
  await expect(stock.stat('Comprometido')).toContainText('-4');

  // 2. Enviada: -4, no longer committed.
  await inv.setStatus(order, 2);
  await poll(6);
  expect(await inv.stock(product)).toMatchObject({ committed: 0, available: 6 });
  expect((await inv.movements(product)).filter((m) => m.type === 'sale').map((m) => m.qty)).toEqual([-4]);
  stock = await openStock(page, product.name);
  await expectExistencia(stock, 6);
  await expectRowQty(stock.row, 6);
  await expect(stock.history.filter({ hasText: 'Consumido' })).toHaveCount(1);

  // 3. Back to Producida: the 4 come back as a compensation, not by editing the sale.
  await inv.setStatus(order, 1);
  await poll(10);
  expect((await inv.movements(product)).filter((m) => m.type === 'compensation').map((m) => m.qty)).toEqual([4]);
  stock = await openStock(page, product.name);
  await expect(stock.history.filter({ hasText: 'Correcciones' })).toHaveCount(1);

  // 4. Enviada again: net one deduction (sale, compensation, sale).
  await inv.setStatus(order, 2);
  await poll(6);
  const moves = await inv.movements(product);
  expect(moves.filter((m) => m.type === 'sale')).toHaveLength(2);
  expect(net(moves, 'sale') + net(moves, 'compensation')).toBe(-4);

  // 5. Entregada: nothing new.
  const before = (await inv.movements(product)).length;
  await inv.setStatus(order, 3);
  await poll(6);
  expect(await inv.movements(product)).toHaveLength(before);

  // 6. Edit the quantity while shipped: only the delta.
  await inv.editLines(order, (item) => { item.quantity = 5; });
  await poll(5);
  const latest = (await inv.movements(product))[0]; // newest first
  expect(latest.qty).toBe(-1);

  // 7. Delete: back to the start.
  await inv.removeOrder(order);
  await poll(10);
  expect(await inv.verify()).toEqual([]);
});

test('S2 a Producir line deducts the recipe at shipping, never the product itself', async ({ inv }) => {
  const flour = await inv.ingredient({ stock: 1000 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });
  const client = await inv.client();

  const order = await inv.order({ client, lines: [{ product, quantity: 2, source: 'produce' }] });
  await expect.poll(qtyOf(inv, flour)).toBe(1000); // not committed, not deducted yet

  await inv.setStatus(order, 2);
  await expect.poll(qtyOf(inv, flour)).toBe(800);
  expect((await inv.stock(product)).currentStock).toBe(0);

  await inv.setStatus(order, 1);
  await expect.poll(qtyOf(inv, flour)).toBe(1000);
  expect((await inv.stock(product)).currentStock).toBe(0);
});

test('S3 switching the source of a shipped line moves the stock between ingredients and the product', async ({ inv }) => {
  const flour = await inv.ingredient({ stock: 1000 });
  const product = await inv.product({ mode: 'recipe', recipe: [{ ingredient: flour, quantity: 100 }] });
  const order = await inv.order({
    client: await inv.client(),
    lines: [{ product, quantity: 2, source: 'produce' }],
    status: 2,
  });
  await expect.poll(qtyOf(inv, flour)).toBe(800);

  await inv.editLines(order, (item) => { item.fulfillmentSource = 'stock'; });
  await expect.poll(qtyOf(inv, flour)).toBe(1000);
  await expect.poll(qtyOf(inv, product)).toBe(-2);

  await inv.editLines(order, (item) => { item.fulfillmentSource = 'produce'; });
  await expect.poll(qtyOf(inv, flour)).toBe(800);
  await expect.poll(qtyOf(inv, product)).toBe(0);
});

test('S4 payment edits on a shipped order write no movement', async ({ inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });
  const order = await inv.order({
    client: await inv.client(),
    lines: [{ product, quantity: 3, source: 'stock' }],
    status: 2,
  });
  await expect.poll(qtyOf(inv, product)).toBe(7);
  const before = (await inv.movements(product)).length;

  await inv.call('PATCH', `/orders/${order.id}`, { isPaid: true });
  expect((await inv.getOrder(order)).isPaid).toBe(true); // the edit landed

  expect(await inv.movements(product)).toHaveLength(before);
  expect((await inv.stock(product)).currentStock).toBe(7);
});

test('S5 a resale line past the stock ships and goes negative', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'unit', stock: 24 });
  await inv.order({
    client: await inv.client(),
    lines: [{ product, quantity: 30, source: 'stock' }],
    status: 2,
  });
  await expect.poll(qtyOf(inv, product)).toBe(-6);

  const stock = await openStock(page, product.name);
  await expectRowQty(stock.row, -6);
  await expect(stock.row).toHaveClass(/ui-item-negative/);
});

test('S6 an untracked product moves nothing and gets no stocks doc', async ({ inv }) => {
  const product = await inv.product({ mode: 'none' });
  const order = await inv.order({
    client: await inv.client(),
    lines: [{ product, quantity: 3 }],
    status: 2,
  });

  expect(await inv.stock(product)).toBeUndefined();
  expect(await inv.movements(product)).toEqual([]);
  expect(await inv.orderMovements(order)).toEqual([]);
});

test('S11 bulk shipping deducts each order once', async ({ inv }) => {
  const product = await inv.product({ mode: 'unit', stock: 30 });
  const client = await inv.client();
  const orders = [];
  for (let i = 0; i < 3; i++) orders.push(await inv.order({ client, lines: [{ product, quantity: 2, source: 'stock' }] }));

  await inv.bulkStatus(orders, 2);
  await expect.poll(qtyOf(inv, product)).toBe(24);

  for (const order of orders) {
    const moves = await inv.orderMovements(order);
    expect(moves.map((m) => [m.type, m.qty])).toEqual([['sale', -2]]);
  }
});
