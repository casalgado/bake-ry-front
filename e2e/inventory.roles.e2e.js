import { randomUUID } from 'node:crypto';
import { test, expect } from './inventory-ui.js';
import { api, itemKey } from './inventory-api.js';

// BROWSER-CHECKS §9: the roles matrix, walked through the API (the router guard is covered by the users suite).
// Each role makes the same calls; the matrix says which may succeed, the rest must be refused with 403.
const ALL = ['bakery_admin', 'bakery_staff', 'production_assistant', 'delivery_assistant', 'accounting_assistant'];
const MATRIX = {
  read: ALL,
  adjust: ['bakery_admin', 'bakery_staff'],
  purchase: ['bakery_admin', 'bakery_staff'],
  sendRun: ['bakery_admin', 'bakery_staff'],
  receiveLine: ['bakery_admin', 'bakery_staff', 'production_assistant'],
  count: ['bakery_admin', 'bakery_staff'],
  ship: ALL,
  verify: ['bakery_admin'],
};

const statusOf = (promise) =>
  promise.then(() => 200, (error) => Number(/-> (\d+)/.exec(error.message)?.[1]));

test.afterEach(async ({ inv }) => {
  await inv.clearCounts();
});

for (const role of ALL) {
  test(`§9 ${role} can do exactly what the matrix allows`, async ({ request, inv }) => {
    const user = role === 'bakery_admin' ? undefined : await inv.staff(role);
    const me = await api(request, user);
    const client = await inv.client();

    // What each action works on, made by the admin.
    const flour = await inv.ingredient({ stock: 100 });
    const provider = await inv.provider();
    const made = await inv.product({ mode: 'recipe' });
    const run = await inv.run({ lines: [{ item: made, plannedQty: 1 }] });
    const shelf = await inv.product({ mode: 'unit', stock: 5 });
    const order = await inv.order({ client, lines: [{ product: shelf, quantity: 1, source: 'stock' }] });

    const actions = {
      read: () => me.call('GET', '/stocks'),
      adjust: () => me.call('POST', `/stocks/${itemKey(flour)}/adjust`, { qty: 1, reason: 'roles', idempotencyKey: randomUUID() }),
      purchase: () => me.purchase({ provider, lines: [{ item: flour, qty: 1, total: 5 }] }),
      sendRun: () => me.run({ lines: [{ item: made, plannedQty: 1 }] }),
      receiveLine: () => me.call('POST', `/productionRuns/${run.id}/lines/${run.lines[0].id}/receive`),
      count: () => me.openCount(),
      ship: () => me.setStatus(order, 2),
      verify: () => me.verify(),
    };

    for (const [action, act] of Object.entries(actions)) {
      const expected = MATRIX[action].includes(role) ? 200 : 403;
      expect(await statusOf(act()), `${role} · ${action}`).toBe(expected);
    }

    // A refused write left nothing behind.
    if (!MATRIX.receiveLine.includes(role)) expect((await inv.stock(made)).currentStock).toBe(0);
    if (!MATRIX.adjust.includes(role)) expect((await inv.stock(flour)).currentStock).toBe(100);
  });
}

test('§9 Firestore rules: orders cannot be written from a browser session, but can be read', async ({ request, inv, fs }) => {
  const user = await inv.staff('bakery_staff');
  const { token } = await api(request, user);
  const { write, read } = await fs.ordersAs(token);
  expect(write).toBe(403);
  expect(read).toBe(200);
});
