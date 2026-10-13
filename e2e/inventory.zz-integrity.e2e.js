import { test, expect } from './inventory-ui.js';

// BROWSER-CHECKS §11. Last by file name: after every other spec, the cache must still match the ledger and
// every shipped order must have its movements. A leak from any spec shows here with the item or order named.
test('§11 verify: every stocks cache equals its ledger', async ({ inv }) => {
  expect(await inv.verify()).toEqual([]);
});

test('§11 verify-orders: every shipped order has its movements', async ({ inv }) => {
  expect(await inv.verifyOrders()).toEqual([]);
});
