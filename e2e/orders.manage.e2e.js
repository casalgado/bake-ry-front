import { test, expect } from '@playwright/test';
import { api, inDays, uniqueNote, ymd } from './orders-api.js';
import { loginAdmin, openOn, money, rowOf } from './orders-ui.js';

// Tomorrow is the shared pool: these tests only touch the row carrying their own note.
const POOL = 1;

test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

const seedOrder = async () => {
  const { createOrder } = await api();
  const note = uniqueNote();
  await createOrder({
    client: 'Cliente Persona',
    day: inDays(POOL),
    internalNotes: note,
    lines: [{ product: 'pan campesino', quantity: 1 }],
  });
  return note;
};

// Selects the order's row and opens a toolbar action.
const selectAndAct = async (page, note, action) => {
  await openOn(page, '/dashboard/orders', { days: POOL });
  await rowOf(page, note).click();
  await page.getByRole('button', { name: action, exact: true }).click();
};

const waitFor = (page, method) =>
  page.waitForResponse((r) => r.request().method() === method && /\/orders(\/\w+)?$/.test(r.url()));

test('editing the quantity updates the total', async ({ page }) => {
  const note = await seedOrder();
  await selectAndAct(page, note, 'Editar');

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton').first().fill('3');
  const saved = waitFor(page, 'PUT');
  await dialog.getByRole('button', { name: 'Actualizar Pedido' }).click();
  expect((await saved).ok()).toBe(true);

  await expect(dialog).toBeHidden();
  await expect(rowOf(page, note)).toContainText(money(30000));
});

test('duplicating creates a pending copy on the chosen day and keeps the original', async ({ page }) => {
  const note = await seedOrder();
  await selectAndAct(page, note, 'Duplicar');

  const dialog = page.getByRole('dialog');
  await dialog.locator('#preparation-date').fill(ymd(inDays(0)));
  const created = waitFor(page, 'POST');
  await dialog.getByRole('button', { name: 'Crear Pedido' }).click();
  expect((await created).ok()).toBe(true);
  await expect(dialog).toBeHidden();

  // The list appends the new order whatever its day, so reload to see what is really stored.
  await openOn(page, '/dashboard/orders', { days: POOL });
  await expect(rowOf(page, note)).toHaveCount(1); // the original, still on its day
  await openOn(page, '/dashboard/orders');
  await expect(rowOf(page, note)).toContainText('Pan Campesino'); // the copy keeps the notes
});

test('deleting removes the order after confirming', async ({ page }) => {
  const note = await seedOrder();
  await selectAndAct(page, note, 'Eliminar');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Eliminar Pedido');
  const deleted = waitFor(page, 'DELETE');
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  expect((await deleted).ok()).toBe(true);

  await expect(rowOf(page, note)).toHaveCount(0);
});
