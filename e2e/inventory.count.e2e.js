import { test, expect, loginAdmin, expectExistencia, openStock } from './inventory-ui.js';
import { itemKey } from './inventory-api.js';

// BROWSER-CHECKS §7 (C1-C7, C13/C14, C18-C22, C24, C26). One open count per bodega, bakery-wide: every test
// starts with none, leaves none, and only types numbers for items it made (a close touches counted rows only).
test.beforeEach(async ({ page, inv }) => {
  await inv.clearCounts();
  await loginAdmin(page);
});

test.afterEach(async ({ inv }) => {
  await inv.clearCounts();
});

const LIST = '/dashboard/inventory/conteos';
const countUrl = (count) => `${LIST}/${count.id}`;
const revisar = (count) => `${LIST}/${count.id}/revisar`;

// The counting page narrowed to one item.
const openCounting = async (page, count, name) => {
  await page.goto(countUrl(count));
  await page.getByRole('searchbox', { name: 'Buscar artículo' }).fill(name);
  const row = page.locator('.ui-item-divided').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  return { row, box: row.getByLabel('Cantidad contada de', { exact: false }) };
};

// What the server holds for one row of a count.
const savedQty = (inv, count, item) => async () => (await inv.getCount(count)).items?.[itemKey(item)]?.qty;

const review = (page, name) => page.locator('.ui-item-divided').filter({ hasText: name });
const closeButton = (page) => page.getByRole('button', { name: /^Cerrar conteo/ });
const confirm = (page, name) => page.getByRole('dialog').getByRole('button', { name, exact: true });

test('C1 an empty list offers Empezar; pressing it opens a count; the open one is pinned, with no second Empezar', async ({ page, inv }) => {
  await page.goto(LIST);
  await expect(page.getByRole('button', { name: 'Empezar conteo' })).toBeVisible();
  await page.getByRole('button', { name: 'Empezar conteo' }).click();
  await expect(page).toHaveURL(/\/conteos\/[^/]+$/);

  await page.goto(LIST);
  await expect(page.getByText(/Continuar/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Empezar conteo|Unirse/ })).toHaveCount(0);
  expect((await inv.call('GET', '/stockCounts')).filter((c) => c.status === 'open')).toHaveLength(1);
});

test('C2 two tabs pressing Empezar land on the same count', async ({ page, inv }) => {
  const other = await page.context().newPage();
  await Promise.all([page.goto(LIST), other.goto(LIST)]);
  await Promise.all([
    page.getByRole('button', { name: 'Empezar conteo' }).click(),
    other.getByRole('button', { name: 'Empezar conteo' }).click(),
  ]);
  await expect(page).toHaveURL(/\/conteos\/[^/]+$/);
  await expect(other).toHaveURL(/\/conteos\/[^/]+$/);
  expect(other.url()).toBe(page.url());
  expect((await inv.call('GET', '/stockCounts')).filter((c) => c.status === 'open')).toHaveLength(1);
});

test('C3 a count started elsewhere shows on the list when you return to the tab', async ({ page, inv }) => {
  await page.goto(LIST);
  await expect(page.getByRole('button', { name: 'Empezar conteo' })).toBeVisible();
  await inv.openCount();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/Continuar/)).toBeVisible();
});

test('C4 typing saves on its own and shows to the other tab; 0 counts, clearing un-counts, decimals work', async ({ page, inv }) => {
  const item = await inv.ingredient({ stock: 10 });
  const count = await inv.openCount();
  const { row, box } = await openCounting(page, count, item.name);
  const other = await page.context().newPage();
  const mirror = await openCounting(other, count, item.name);

  await expect(row).toContainText('sin contar');
  await expect(row).not.toContainText('sistema decía'); // the expected figure only appears after entry

  await box.fill('8');
  await expect.poll(savedQty(inv, count, item)).toBe(8);
  await expect(row).toContainText('sistema decía 10');
  await expect(row).toContainText('-2');
  await expect(mirror.row).toContainText('sistema decía 10'); // live, in the other tab

  await box.fill('0');
  await expect.poll(savedQty(inv, count, item)).toBe(0);
  await expect(row).not.toContainText('sin contar');

  await box.fill('2.5');
  await expect.poll(savedQty(inv, count, item)).toBe(2.5);

  await box.fill('');
  await expect.poll(savedQty(inv, count, item)).toBeUndefined();
  await expect(row).toContainText('sin contar');
  await expect(mirror.row).toContainText('sin contar');
});

test('C5 a negative is refused without clearing the saved number, and blocks Revisar until fixed', async ({ page, inv }) => {
  const item = await inv.ingredient({ stock: 10 });
  const count = await inv.openCount();
  const { row, box } = await openCounting(page, count, item.name);

  await box.fill('5');
  await expect.poll(savedQty(inv, count, item)).toBe(5);
  await box.fill('-3');
  await expect(row).toContainText('Escribe 0 o más. No se guardó.');
  await page.waitForTimeout(1000);
  expect(await savedQty(inv, count, item)()).toBe(5); // never cleared

  await page.getByRole('button', { name: /^Revisar/ }).click();
  await expect(page).not.toHaveURL(/revisar/);
  await expect(page.getByText(/Hay números sin guardar/)).toBeVisible();

  await box.fill('4');
  await page.getByRole('button', { name: /^Revisar/ }).click();
  await expect(page).toHaveURL(/revisar/);
});

test('C6 a failed save says so, and retyping once online saves it', async ({ page, inv }) => {
  const item = await inv.ingredient({ stock: 10 });
  const count = await inv.openCount();
  const { row, box } = await openCounting(page, count, item.name);

  await page.route(/stockCounts\/[^/]+\/items\//, (route) => route.abort());
  await box.fill('7');
  await expect(row).toContainText('No se guardó: vuelve a escribirlo.');
  expect(await savedQty(inv, count, item)()).toBeUndefined();

  await page.unroute(/stockCounts\/[^/]+\/items\//);
  await box.fill('6');
  await expect.poll(savedQty(inv, count, item)).toBe(6);
  await expect(row).not.toContainText('No se guardó');
});

test('C7 Revisar pressed right after typing waits for the save and includes the number', async ({ page, inv }) => {
  const item = await inv.ingredient({ stock: 10 });
  const count = await inv.openCount();
  const { box } = await openCounting(page, count, item.name);

  await box.fill('7');
  await page.getByRole('button', { name: /^Revisar|Guardando/ }).click(); // inside the 0.4 s debounce
  await expect(page).toHaveURL(/revisar/);
  await expect(review(page, item.name)).toContainText('contado 7');
  expect(await savedQty(inv, count, item)()).toBe(7);
});

test('C13 C14 the alert fires from $50.000 of difference, never for an item without cost', async ({ page, inv }) => {
  const over = await inv.ingredient({ cost: 6000, stock: 100 });
  const under = await inv.ingredient({ cost: 6000, stock: 100 });
  const free = await inv.ingredient({ cost: 0, stock: 100 });
  const same = await inv.ingredient({ cost: 6000, stock: 100 });
  const count = await inv.openCount();
  await inv.countItem(count, over, 91); // -9 × 6000 = 54.000
  await inv.countItem(count, under, 92); // -8 × 6000 = 48.000
  await inv.countItem(count, free, 50);
  await inv.countItem(count, same, 100);

  await page.goto(revisar(count));
  await expect(review(page, over.name)).toContainText('alerta');
  await expect(review(page, under.name)).not.toContainText('alerta');
  await expect(review(page, under.name)).toContainText('-8');
  await expect(review(page, free.name)).toContainText('sin costo');
  await expect(review(page, free.name)).not.toContainText('alerta');
  await expect(closeButton(page)).toContainText(/con 1 alerta/);

  await expect(review(page, same.name)).toHaveCount(0); // folded away
  await page.getByRole('button', { name: /sin diferencia$/ }).click();
  await expect(review(page, same.name)).toBeVisible();
});

test('C16 with nothing counted the close button is disabled', async ({ page, inv }) => {
  const count = await inv.openCount();
  await page.goto(revisar(count));
  await expect(closeButton(page)).toBeDisabled();
});

test('C18 C19 closing asks first, then sets the counted numbers, leaving the rest alone', async ({ page, inv }) => {
  const counted = await inv.ingredient({ cost: 10, stock: 10 });
  const matching = await inv.ingredient({ cost: 10, stock: 5 });
  const untouched = await inv.ingredient({ cost: 10, stock: 7 });
  const count = await inv.openCount();
  await inv.countItem(count, counted, 8);
  await inv.countItem(count, matching, 5);

  await page.goto(revisar(count));
  await closeButton(page).click();
  await expect(page.getByRole('dialog')).toContainText('La existencia de 2 artículos pasa a ser lo que se contó.');
  await confirm(page, 'Volver').click();
  expect((await inv.stock(counted)).currentStock).toBe(10);

  await closeButton(page).click();
  await confirm(page, 'Cerrar conteo').click();
  await expect(page.getByText(/^Cerrado el /)).toBeVisible();
  await expect(page.getByText(/Desde el último conteo: bajas reportadas/)).toBeVisible();

  expect((await inv.stock(counted)).currentStock).toBe(8);
  expect((await inv.stock(untouched)).currentStock).toBe(7);
  const counts = (await inv.movements(counted)).filter((m) => m.type === 'count');
  expect(counts.map((m) => m.qty)).toEqual([-2]);
  expect((await inv.movements(matching)).filter((m) => m.type === 'count')).toEqual([]); // verified, nothing to write

  const stock = await openStock(page, counted.name);
  await expectExistencia(stock, 8);
  await expect(stock.history.filter({ hasText: 'Conteos' })).toHaveCount(1);
});

test('C20 a closed count reopens frozen, and its counting page redirects to Revisar', async ({ page, inv }) => {
  const item = await inv.ingredient({ cost: 10, stock: 10 });
  const count = await inv.openCount();
  await inv.countItem(count, item, 9);
  await inv.closeCount(count);

  await page.goto(countUrl(count));
  await expect(page).toHaveURL(/revisar/);
  await expect(page.getByText(/^Cerrado el /)).toBeVisible();
  await expect(review(page, item.name)).toContainText('sistema 10 · contado 9');
  await expect(closeButton(page)).toHaveCount(0);
});

test('C21 closing in two tabs: the second is refused and nothing is written twice', async ({ page, inv }) => {
  const item = await inv.ingredient({ cost: 10, stock: 10 });
  const count = await inv.openCount();
  await inv.countItem(count, item, 9);

  const other = await page.context().newPage();
  await Promise.all([page.goto(revisar(count)), other.goto(revisar(count))]);
  await closeButton(page).click();
  await confirm(page, 'Cerrar conteo').click();
  await expect(page.getByText(/^Cerrado el /)).toBeVisible();

  // The other tab follows the count live, so it turns frozen with no button left to press;
  // a close that still reaches the server (a stale request) is refused.
  await expect(other.getByText(/^Cerrado el /)).toBeVisible();
  await expect(closeButton(other)).toHaveCount(0);
  await expect(inv.closeCount(count)).rejects.toThrow();
  expect((await inv.movements(item)).filter((m) => m.type === 'count')).toHaveLength(1);
  expect((await inv.stock(item)).currentStock).toBe(9);
});

test('C22 a count that closes under an open counting tab sends it to Revisar, and a late number is refused', async ({ page, inv }) => {
  const item = await inv.ingredient({ cost: 10, stock: 10 });
  const other = await inv.ingredient({ cost: 10, stock: 10 });
  const count = await inv.openCount();
  await inv.countItem(count, other, 10);
  await openCounting(page, count, item.name);

  await inv.closeCount(count);
  await expect(page).toHaveURL(/revisar/);
  await expect(inv.countItem(count, item, 3)).rejects.toThrow();
  expect((await inv.stock(item)).currentStock).toBe(10);
  expect((await inv.getCount(count)).items?.[itemKey(item)]).toBeUndefined();
});

test('C24 a half-finished close is listed as Cerrando and Terminar de cerrar finishes it', async ({ page, inv, fs }) => {
  const item = await inv.ingredient({ cost: 10, stock: 10 });
  const count = await inv.openCount();
  await inv.countItem(count, item, 6);
  await fs.forceClosing(await inv.getCount(count));

  await page.goto(LIST);
  await expect(page.getByText('Cerrando · 1 contados')).toBeVisible();

  await page.goto(countUrl(count)); // typing is impossible: it redirects to Revisar
  await expect(page).toHaveURL(/revisar/);
  await expect(page.getByText('Cerrando el conteo…')).toBeVisible();
  await page.getByRole('button', { name: 'Terminar de cerrar' }).click();
  await expect(page.getByRole('dialog')).toContainText('Se retoma el cierre donde quedó.');
  await confirm(page, 'Terminar').click();

  await expect(page.getByText(/^Cerrado el /)).toBeVisible();
  expect((await inv.getCount(count)).status).toBe('closed');
  expect((await inv.stock(item)).currentStock).toBe(6);
  expect((await inv.movements(item)).filter((m) => m.type === 'count').map((m) => m.qty)).toEqual([-4]);
});

test('C26 discarding moves nothing, keeps what was typed read-only, and the next Empezar is fresh', async ({ page, inv }) => {
  const item = await inv.ingredient({ cost: 10, stock: 10 });
  const count = await inv.openCount();
  await inv.countItem(count, item, 3);

  await page.goto(countUrl(count));
  await page.getByRole('button', { name: 'Descartar' }).click();
  await confirm(page, 'Descartar').click();
  await expect(page).toHaveURL(new RegExp(`${LIST}$`));
  await expect(page.getByText(/Descartado · por .* · 1 escritos/).first()).toBeVisible(); // newest first

  await page.getByText(/Descartado/).first().click();
  await expect(page).toHaveURL(/revisar/);
  await expect(review(page, item.name)).toContainText('3');
  expect((await inv.stock(item)).currentStock).toBe(10);
  expect((await inv.movements(item)).filter((m) => m.type === 'count')).toEqual([]);

  const fresh = await inv.openCount();
  expect(fresh.id).not.toBe(count.id);
  expect((await inv.getCount(fresh)).items?.[itemKey(item)]).toBeUndefined();
});
