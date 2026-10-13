import { test, expect } from '@playwright/test';
import { api, inDays, uniqueNote } from './orders-api.js';
import { loginAdmin, openOn, rowOf } from './orders-ui.js';

const DELIVERY = '/dashboard/orders/delivery';
const DAY = 1; // tomorrow, shared: rows are told apart by note and selected one by one

test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

// The Estado toggle shows icons, not text, so read the stored value through the API.
const statusOf = (client, id) => async () => (await client.getOrder(id)).status;

const seedOrders = async (count) => {
  const client = await api();
  const orders = await Promise.all(Array.from({ length: count }, async () => {
    const note = uniqueNote();
    const order = await client.createOrder({
      client: 'Cliente Persona',
      day: inDays(DAY),
      internalNotes: note,
      lines: [{ product: 'pan campesino' }],
    });
    return { id: order.id, note };
  }));
  return { client, orders };
};

const estadoCell = (page, note) => rowOf(page, note).getByRole('cell').last();

// A toggle clicked while the table is still applying the previous one is computed from the
// old value, so wait for the table to stop loading before the next click.
const settled = (page) => expect(page.locator('tbody.opacity-20')).toHaveCount(0);

// A click on a row toggles its selection; shift-click would pull in other tests' rows.
const select = async (page, orders) => {
  for (const { note } of orders) await rowOf(page, note).click();
};

test('the Estado toggle walks 0 → 1 → 2 → 3 and each step is stored', async ({ page }) => {
  const { client, orders: [order] } = await seedOrders(1);
  await openOn(page, DELIVERY, { days: DAY });

  for (const expected of [1, 2, 3]) {
    await estadoCell(page, order.note).click();
    await expect.poll(statusOf(client, order.id)).toBe(expected);
    await settled(page);
  }
});

test('toggling a selected row changes every selected row', async ({ page }) => {
  const { client, orders } = await seedOrders(3);
  await openOn(page, DELIVERY, { days: DAY });

  await select(page, orders);
  await estadoCell(page, orders[0].note).click();

  for (const { id } of orders) await expect.poll(statusOf(client, id)).toBe(1);
});

test('more than 20 selected rows is refused and nothing changes', async ({ page }) => {
  const { client, orders } = await seedOrders(21);
  await openOn(page, DELIVERY, { days: DAY });

  await expect(rowOf(page, orders[20].note)).toHaveCount(1);
  await page.getByRole('button', { name: 'Todo', exact: true }).click(); // 21+ rows of the day
  await estadoCell(page, orders[0].note).click();

  await expect(page.getByText('Máximo 20 filas a la vez')).toBeVisible();
  for (const { id } of [orders[0], orders[20]]) expect(await statusOf(client, id)()).toBe(0);
});
