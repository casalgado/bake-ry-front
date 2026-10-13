import { test, expect } from '@playwright/test';
import { api, inDays, uniqueNote } from './orders-api.js';
import { loginAdmin, openOn, rowOf } from './orders-ui.js';

// One order from the kitchen to the cash drawer, each step on the screen that owns it.
test('an order is produced, delivered and paid, and leaves Por Cobrar', async ({ page }) => {
  test.setTimeout(180_000); // four screens, each loading through the slow emulator
  const bakery = await api();
  const product = await bakery.createProduct();
  const note = uniqueNote();
  const order = await bakery.createOrder({
    client: 'Cliente Empresa',
    day: inDays(1),
    internalNotes: note,
    lines: [{ product: product.name, quantity: 2 }],
  });
  await loginAdmin(page);

  // kitchen: the line is produced
  await openOn(page, '/dashboard/orders/production/single', { days: 1 });
  await rowOf(page, note).getByRole('cell').last().click();
  await expect(rowOf(page, note)).toContainText(/producido/i);
  await expect.poll(async () => (await bakery.getOrder(order.id)).orderItems[0].status).toBe(1);

  // delivery: oven → on its way → delivered
  await openOn(page, '/dashboard/orders/delivery', { days: 1 });
  for (const expected of [1, 2, 3]) {
    await rowOf(page, note).getByRole('cell').last().click();
    await expect.poll(async () => (await bakery.getOrder(order.id)).status).toBe(expected);
    await expect(page.locator('tbody.opacity-20')).toHaveCount(0);
  }

  // accounting: owed, then paid
  await page.goto('/dashboard/orders/unpaid');
  await expect(rowOf(page, note)).toHaveCount(1);
  await rowOf(page, note).getByRole('cell').nth(6).click(); // Pagado
  await expect.poll(async () => (await bakery.getOrder(order.id)).isPaid).toBe(true);
  await page.goto('/dashboard/orders/unpaid');
  await expect(page.getByRole('row').nth(1)).toBeVisible(); // the table has loaded
  await expect(rowOf(page, note)).toHaveCount(0);
});
