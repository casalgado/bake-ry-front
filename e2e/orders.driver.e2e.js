import { test, expect } from '@playwright/test';
import { loginAs } from './helpers.js';
import { api, inDays, uniqueNote, DRIVER } from './orders-api.js';
import { rowOf } from './orders-ui.js';

// The driver view lists the driver's orders for today (its default period). The delivery
// address carries the per-test marker, since that is what the driver table shows.
const seedDelivery = async ({ assigned }) => {
  const client = await api();
  const address = `Calle ${uniqueNote()}`;
  const order = await client.createOrder({
    client: 'Cliente Persona',
    day: inDays(0),
    fulfillmentType: 'delivery',
    deliveryAddress: address,
    ...(assigned && { deliveryDriverId: client.users.Driver.id }),
    lines: [{ product: 'pan campesino', quantity: 1 }],
  });
  return { client, order, address };
};

test('driver sees only the orders assigned to them', async ({ browser }) => {
  const { address: mine } = await seedDelivery({ assigned: true });
  const { address: theirs } = await seedDelivery({ assigned: false });

  const page = await loginAs(browser, DRIVER);
  await expect(page).toHaveURL(/\/driver\/orders/);
  await expect(page.getByText('Mis Entregas')).toBeVisible();
  await expect(rowOf(page, mine)).toHaveCount(1);
  await expect(rowOf(page, theirs)).toHaveCount(0);
});

test('the driver marks a delivery on its way, then delivered', async ({ browser }) => {
  const { client, order, address } = await seedDelivery({ assigned: true });
  const page = await loginAs(browser, DRIVER);
  await expect(rowOf(page, address)).toHaveCount(1);

  // The driver's Estado skips "in the oven": 0 → 2 → 3.
  for (const expected of [2, 3]) {
    await rowOf(page, address).getByRole('cell').last().click();
    await expect.poll(async () => (await client.getOrder(order.id)).status).toBe(expected);
    await expect(page.locator('tbody.opacity-20')).toHaveCount(0);
  }
});
