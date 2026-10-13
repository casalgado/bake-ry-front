import { test, expect } from '@playwright/test';
import { api, inMonths } from './orders-api.js';

const inDaysOf = (date, n) => new Date(date.getTime() + n * 24 * 3600 * 1000);
import { loginAdmin, openOn, money, rowOf } from './orders-ui.js';

test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

// The sales report sums every order due in the month, paid or not (its "paid orders" label
// is the field name, not a filter), so a month of our own gives exact totals.
test('the sales report adds up the orders due in the month, split by client type and delivery', async ({ page }) => {
  const bakery = await api();
  const month = await bakery.freeMonth();
  const day = inMonths(month);
  const lines = (quantity) => [{ product: 'pan campesino', quantity }];

  await bakery.createOrder({ client: 'Cliente Empresa', day, lines: lines(3) }); // B2B 30,000
  await bakery.createOrder({ client: 'Cliente Persona', day, lines: lines(1) }); // B2C 10,000
  await bakery.createOrder({
    client: 'Cliente Persona', day, lines: lines(1), fulfillmentType: 'delivery', deliveryFee: 5000,
  }); // B2C 10,000 + 5,000 delivery

  await openOn(page, '/dashboard/salesReport', { months: month });
  const summary = (label) => rowOf(page, label);

  await expect(summary('Total Pedidos')).toContainText('3');
  await expect(summary('Venta B2B')).toContainText(money(30000));
  await expect(summary('Venta B2C')).toContainText(money(20000));
  await expect(summary('Ingreso Domicilios')).toContainText(money(5000));
  await expect(summary('Venta Total')).toContainText(money(50000));
  await expect(summary('Ingresos Totales')).toContainText(money(55000));
});

test('payment dates list full payments, partial payments and the balance, not gifts', async ({ page }) => {
  const bakery = await api();
  const month = await bakery.freeMonth();
  const day = inMonths(month);
  const later = inDaysOf(day, 2);
  const lines = (quantity) => [{ product: 'pan campesino', quantity }];

  // 10,000 paid in one go
  await bakery.createOrder({
    client: 'Cliente Persona', day, lines: lines(1), isPaid: true, paymentDate: day.toISOString(),
  });
  // 30,000: 10,000 up front, the balance two days later
  await bakery.createOrder({
    client: 'Cliente Empresa',
    day,
    lines: lines(3),
    partialPayments: [{ amount: 10000, date: day.toISOString() }],
    isPaid: true,
    paymentDate: later.toISOString(),
  });
  // a gift is not a payment
  await bakery.createOrder({
    client: 'Cliente Persona', day, lines: lines(5), paymentMethod: 'complimentary', isPaid: true, paymentDate: day.toISOString(),
  });

  await openOn(page, '/dashboard/paymentDates', { months: month });

  const full = rowOf(page, 'completo');
  await expect(full).toHaveCount(1);
  await expect(full).toContainText('Cliente Persona');
  await expect(full).toContainText(money(10000));

  const partial = rowOf(page, 'parcial');
  await expect(partial).toHaveCount(1);
  await expect(partial).toContainText('Cliente Empresa');
  await expect(partial).toContainText(money(10000));

  const balance = rowOf(page, 'saldo');
  await expect(balance).toHaveCount(1);
  await expect(balance).toContainText(money(20000));

  // three payments in all; the gift added nothing
  await expect(rowOf(page, /Cliente (Persona|Empresa)/)).toHaveCount(3);
});
