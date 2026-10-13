import { test, expect } from '@playwright/test';
import { api, inDays, uniqueNote } from './orders-api.js';
import { loginAdmin, openOn, rowOf } from './orders-ui.js';

const SINGLE = '/dashboard/orders/production/single';
const GROUPED = '/dashboard/orders/production/grouped';
const DAY = 1; // tomorrow, shared with other specs: everything here is told apart by product and note

test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

// Two clients order a product of this test's own, 2 and 3 units. The product name is shown
// title-cased, so rows are matched case-insensitively.
const seed = async () => {
  const { createOrder, createProduct, patchOrder } = await api();
  const product = await createProduct();
  const day = inDays(DAY);
  const persona = uniqueNote();
  const empresa = uniqueNote();
  const lines = (quantity) => [{ product: product.name, quantity }];
  const first = await createOrder({ client: 'Cliente Persona', day, internalNotes: persona, lines: lines(2) });
  await createOrder({ client: 'Cliente Empresa', day, internalNotes: empresa, lines: lines(3) });
  return { name: new RegExp(product.name, 'i'), persona, empresa, first, patchOrder };
};

const quantityOf = (n, name) => new RegExp(`${n} ${name.source}`, 'i');

test('individual lists each order line, grouped sums them', async ({ page }) => {
  const { name, persona, empresa } = await seed();

  await openOn(page, SINGLE, { days: DAY });
  await expect(rowOf(page, persona)).toContainText('Cliente Persona');
  await expect(rowOf(page, persona)).toContainText(name);
  await expect(rowOf(page, empresa)).toContainText('Cliente Empresa');

  await openOn(page, GROUPED, { days: DAY });
  const group = rowOf(page, name);
  await expect(group).toHaveCount(1);
  await expect(group).toContainText(/2 clientes/i);
  await expect(group).toContainText(quantityOf(5, name));
});

test('a quantity edit shows up in both views', async ({ page }) => {
  const { name, persona, first, patchOrder } = await seed();
  await patchOrder(first.id, { orderItems: [{ ...first.orderItems[0], quantity: 4 }] });

  await openOn(page, SINGLE, { days: DAY });
  await expect(rowOf(page, persona)).toContainText(quantityOf(4, name));

  await openOn(page, GROUPED, { days: DAY });
  await expect(rowOf(page, name)).toContainText(quantityOf(7, name)); // 4 + 3
});

test('marking a line as produced moves grouped from "-" to "1/2"', async ({ page }) => {
  const { name, persona } = await seed();

  await openOn(page, GROUPED, { days: DAY });
  await expect(rowOf(page, name)).toContainText(/2 clientes/i);

  await openOn(page, SINGLE, { days: DAY });
  const row = rowOf(page, persona);
  await row.getByRole('cell').last().click();
  await expect(row).toContainText(/producido/i);

  await openOn(page, GROUPED, { days: DAY });
  await expect(rowOf(page, name)).toContainText('1/2');
});
