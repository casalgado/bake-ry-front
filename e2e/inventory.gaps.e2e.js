import { test, expect } from './inventory-ui.js';

// BROWSER-CHECKS §2 S7, S9, S19. Inventory never blocks a sale: a line it can't follow becomes a
// stockGaps doc and the order still ships. No browser needed, so no `page`.
const qtyOf = (inv, item) => async () => (await inv.stock(item))?.currentStock;

test('S7 a recipe product with no recipe ships, leaves a gap, and deducts once the recipe exists', async ({ inv, fs }) => {
  const flour = await inv.ingredient({ stock: 1000 });
  const product = await inv.product({ mode: 'recipe' }); // no recipe
  const order = await inv.order({
    client: await inv.client(),
    lines: [{ product, quantity: 2, source: 'produce' }],
    status: 2,
  });

  expect((await inv.getOrder(order)).status).toBe(2);
  await expect.poll(() => fs.gaps(order)).toEqual([expect.objectContaining({ reason: 'missingRecipe' })]);
  expect(await inv.orderMovements(order)).toEqual([]);

  // The repair path: add the recipe, then toggle Producida <-> Enviada.
  await inv.addRecipe(product, [{ ingredient: flour, quantity: 100 }]);
  await inv.setStatus(order, 1);
  await inv.setStatus(order, 2);

  await expect.poll(qtyOf(inv, flour)).toBe(800);
  await expect.poll(() => fs.gaps(order)).toEqual([]);
});

test('S9 a combination without a recipe is a gap and never borrows the product recipe', async ({ inv, fs }) => {
  // Seeded: baguette "original" has recipes on x5 and x5 integral, none on "otra".
  const baguette = await inv.seededProduct('baguette', 'original');
  const order = await inv.order({
    client: await inv.client(),
    lines: [{ product: baguette, combination: 'otra', quantity: 1, source: 'produce' }],
    status: 2,
  });

  await expect.poll(() => fs.gaps(order)).toEqual([expect.objectContaining({ reason: 'missingRecipe' })]);
  expect(await inv.orderMovements(order)).toEqual([]);
});

test('S19 an order shipped behind the API is found by verify-orders and repaired by reconcile-orders', async ({ inv, fs }) => {
  const product = await inv.product({ mode: 'unit', stock: 10 });
  const order = await inv.order({ client: await inv.client(), lines: [{ product, quantity: 3, source: 'stock' }] });

  await fs.forceShipped(order); // status 2 + shippedAt written straight to the document
  expect(await inv.orderMovements(order)).toEqual([]);
  expect((await inv.stock(product)).currentStock).toBe(10);

  const listed = (await inv.verifyOrders()).find((o) => o.orderId === order.id);
  expect(listed, 'verify-orders lists the order').toBeTruthy();
  expect(listed.diffs.map((d) => d.diff)).toEqual([-3]);
  expect(await inv.verify()).toEqual([]); // the cache still matches the ledger

  const { repaired, failed } = await inv.reconcileOrders();
  expect(repaired).toContain(order.id);
  expect(failed).toEqual([]);

  expect((await inv.orderMovements(order)).map((m) => [m.type, m.qty])).toEqual([['sale', -3]]);
  expect((await inv.stock(product)).currentStock).toBe(7);
  expect((await inv.verifyOrders()).find((o) => o.orderId === order.id)).toBeUndefined();
  expect(await inv.verify()).toEqual([]);
});
