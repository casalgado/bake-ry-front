import { test, expect, loginAdmin } from './inventory-ui.js';

// BROWSER-CHECKS §10 G1: the module switch. It is the shared bakery's switch, so it is flipped through the
// settings document and always put back, pass or fail.
test('G1 with the switch off there is no Inventario for the user, and the ledger still records', async ({ page, inv, fs }) => {
  const product = await inv.product({ mode: 'unit', stock: 10 });
  const order = await inv.order({ client: await inv.client(), lines: [{ product, quantity: 3, source: 'stock' }] });
  await loginAdmin(page);

  try {
    await fs.inventoryEnabled(false);
    await page.goto('/dashboard/orders');
    await expect(page.getByRole('main').getByRole('link', { name: 'Pedidos', exact: true }).first()).toBeVisible(); // loaded
    await expect(page.getByRole('main').getByRole('link', { name: 'Existencias' })).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: 'Conteo', exact: true })).toHaveCount(0);

    await page.goto('/dashboard/inventory');
    await expect(page).not.toHaveURL(/\/dashboard\/inventory/);

    await inv.setStatus(order, 2); // shipping still books the sale
    await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(7);
  } finally {
    await fs.inventoryEnabled(true);
  }

  await page.goto('/dashboard/orders');
  await expect(page.getByRole('main').getByRole('link', { name: 'Existencias' })).toBeVisible();
});
