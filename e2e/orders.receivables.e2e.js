import { test, expect } from '@playwright/test';
import { api, inDays, uniqueNote } from './orders-api.js';
import { loginAdmin, money, rowOf } from './orders-ui.js';

const UNPAID = '/dashboard/orders/unpaid';

test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

// Por Cobrar lists every unpaid order whatever its day, so rows are told apart by note.
const seedUnpaid = async ({ client = 'Cliente Empresa', day = inDays(0), quantity = 2 } = {}) => {
  const bakery = await api();
  const note = uniqueNote();
  const order = await bakery.createOrder({
    client,
    day,
    internalNotes: note,
    lines: [{ product: 'pan campesino', quantity }],
  });
  return { bakery, order, note };
};

// The page fetches settings, B2B clients and then the orders one after the other.
const open = async (page) => {
  const loaded = page.waitForResponse((r) => r.ok() && /\/orders\?/.test(r.url()));
  await page.goto(UNPAID);
  await loaded;
  await expect(page.getByRole('heading', { name: 'Por Cobrar', level: 2 })).toBeVisible();
};

test('an unpaid order is listed with its type and what is owed', async ({ page }) => {
  const b2b = await seedUnpaid();
  const b2c = await seedUnpaid({ client: 'Cliente Persona', quantity: 1 });

  await open(page);
  await expect(rowOf(page, b2b.note)).toContainText('B2B');
  await expect(rowOf(page, b2b.note)).toContainText(money(20000));
  await expect(rowOf(page, b2c.note)).toContainText('B2C');
  await expect(rowOf(page, b2c.note)).toContainText(money(10000));
});

test('marking an order paid takes it off the list', async ({ page }) => {
  const paid = await seedUnpaid();
  const control = await seedUnpaid(); // stays unpaid; proves the table loaded when `paid` is gone

  await open(page);
  await rowOf(page, paid.note).getByRole('cell').nth(6).click(); // Pagado
  await expect.poll(async () => (await paid.bakery.getOrder(paid.order.id)).isPaid).toBe(true);

  await open(page);
  await expect(rowOf(page, control.note)).toHaveCount(1);
  await expect(rowOf(page, paid.note)).toHaveCount(0);
});

test('"Vencidas" keeps the orders past their credit days', async ({ page }) => {
  const overdue = await seedUnpaid({ day: inDays(-45) }); // B2B grace period is 30 days
  const recent = await seedUnpaid();

  await open(page);
  await expect(rowOf(page, recent.note)).toHaveCount(1);
  await page.locator('button[aria-haspopup=menu]').click(); // the funnel
  await page.getByText('Vencidas', { exact: true }).click();

  await expect(rowOf(page, overdue.note)).toHaveCount(1);
  await expect(rowOf(page, recent.note)).toHaveCount(0);
});
