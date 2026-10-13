import {
  test, expect, loginAdmin, addProduct, lineOf, setQuantity, expectRed, saveNewOrder, uniqueDay, ymd, openOnDay, rowOf,
} from './inventory-ui.js';

// BROWSER-CHECKS §1 (O1-O5, O10, O11, O15). The chip reads "N disponibles" (Disponible) or "Producir";
// red text means the draft's stock lines ask for more than is free. Each test owns its product, so N is exact.
test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

// Open the form after arranging: its product list is read once, on load. Waits for the stocks too: a line added
// before they arrive is given its default source from an empty figure (Producir) and keeps it.
const openForm = async (page) => {
  const stocks = page.waitForResponse((r) => /\/stocks(\?|$)/.test(r.url()) && r.request().method() === 'GET');
  await page.goto('/dashboard/orders/create');
  await stocks;
};

test('O1 a resale line shows its stock, fixed, and a shortfall warns but still saves', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'unit', stock: 24 });
  const client = await inv.client();

  await openForm(page);
  await addProduct(page, product.name);
  const line = lineOf(page, product.name);
  await expect(line).toContainText('24 disponibles');
  await expect(line.getByRole('button')).toHaveCount(0); // no Disponible/Producir toggle
  await expectRed(line, false);

  await setQuantity(page, 0, 30);
  await expectRed(line);
  await expect(line).toContainText('24 disponibles'); // the figure doesn't move

  await saveNewOrder(page, client, ymd(uniqueDay()));
  const saved = await inv.orderOf(client);
  expect(saved.orderItems[0]).toMatchObject({ quantity: 30, fulfillmentSource: 'stock' });
});

test('O1 resale with no stock reads 0 in red and still saves', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'unit' });
  const client = await inv.client();

  await openForm(page);
  await addProduct(page, product.name);
  const line = lineOf(page, product.name);
  await expect(line).toContainText('0 disponibles');
  await expectRed(line);

  await saveNewOrder(page, client, ymd(uniqueDay()));
  await inv.orderOf(client);
});

test('O2 a recipe line defaults to Disponible when stock covers it, and the chip toggles', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });

  await openForm(page);
  await addProduct(page, product.name);
  const line = lineOf(page, product.name);
  await expect(line).toContainText('10 disponibles');

  await line.getByRole('button').click();
  await expect(line).toContainText('Producir');
  await line.getByRole('button').click();
  await expect(line).toContainText('10 disponibles');
});

test('O2 choosing Disponible for more than the stock turns the chip red but is allowed', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });

  await openForm(page);
  await addProduct(page, product.name);
  const line = lineOf(page, product.name);
  await setQuantity(page, 0, 11); // more than the 10 on the shelf
  await line.getByRole('button').click(); // Disponible -> Producir
  await expect(line).toContainText('Producir');
  await line.getByRole('button').click(); // and back: allowed, warns
  await expect(line).toContainText('10 disponibles');
  await expectRed(line);
});

test('O3 the same product twice shares one figure; a second line defaults to Producir once the first took it all', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });

  await openForm(page);
  await addProduct(page, product.name);
  await setQuantity(page, 0, 10); // the first line takes everything
  await addProduct(page, product.name);
  await expect(lineOf(page, product.name)).toHaveCount(2);
  await expect(lineOf(page, product.name).nth(1)).toContainText('Producir');

  // Switch the second to Disponible: 20 asked, 10 free -> both lines red, both read 10.
  await lineOf(page, product.name).nth(1).getByRole('button').click();
  for (const i of [0, 1]) {
    await expect(lineOf(page, product.name).nth(i)).toContainText('10 disponibles');
    await expectRed(lineOf(page, product.name).nth(i));
  }

  // Quantities never move the figure, only the red flag.
  await setQuantity(page, 0, 4);
  await setQuantity(page, 1, 4);
  for (const i of [0, 1]) {
    await expect(lineOf(page, product.name).nth(i)).toContainText('10 disponibles');
    await expectRed(lineOf(page, product.name).nth(i), false);
  }
});

test('O4 each combination reads its own stock', async ({ page, inv }) => {
  // Seeded Sourdough: pequeño and mediano each own a recipe and a stocks row.
  const sourdough = await inv.seededProduct('sourdough', 'original');
  const [small, medium] = ['pequeño', 'mediano'].map((name) => sourdough.variations.combinations.find((c) => c.name.toLowerCase() === name));
  const keyOf = (c) => ({ type: 'product', id: sourdough.id, combinationId: c.id });

  const [s, m] = [await inv.stock(keyOf(small)), await inv.stock(keyOf(medium))];
  const target = Math.max(s.currentStock, m.currentStock) + 7; // guarantees the two figures differ
  await inv.stockUp(keyOf(medium), target - m.currentStock);
  const [smallAvail, mediumAvail] = [(await inv.stock(keyOf(small))).available, (await inv.stock(keyOf(medium))).available];
  const label = (n) => (n >= 1 ? `${n} disponibles` : 'Producir');

  await openForm(page);
  await addProduct(page, 'original peque');
  await addProduct(page, 'original mediano');
  await expect(lineOf(page, 'pequeño')).toContainText(label(smallAvail));
  await expect(lineOf(page, 'mediano')).toContainText(label(mediumAvail));
  expect(smallAvail).not.toBe(mediumAvail);
});

test('O5 an untracked product shows no chip', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'none' });

  await openForm(page);
  await addProduct(page, product.name);
  const line = lineOf(page, product.name);
  await expect(line).toBeVisible();
  await expect(line).not.toContainText(/disponible|Producir/);
  await expect(line.getByRole('button')).toHaveCount(0);
});

test('O10 editing an open order gives its own lines back; O11 so does a shipped one', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });
  const client = await inv.client();
  const day = uniqueDay();
  const order = await inv.order({ client, day, lines: [{ product, quantity: 5, source: 'stock' }] });
  expect((await inv.stock(product)).available).toBe(5); // 5 of the 10 are committed to this order

  const edit = async () => {
    await openOnDay(page, '/dashboard/orders', day);
    await rowOf(page, client.name).click();
    await page.getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/^Cargando/)).toHaveCount(0, { timeout: 30_000 });
    return lineOf(page, product.name);
  };

  // O10: the figure is 10 (5 free + the order's own 5), whatever the quantity says; 11 turns it red.
  let line = await edit();
  await expect(line).toContainText('10 disponibles');
  await setQuantity(page, 0, 8);
  await expect(line).toContainText('10 disponibles');
  await expectRed(line, false);
  await setQuantity(page, 0, 11);
  await expectRed(line);
  await page.getByRole('button', { name: 'Cancelar' }).click();

  // O11: shipped, stock is 5 and nothing is committed; the figure is still 10.
  await inv.setStatus(order, 2);
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(5);
  line = await edit();
  await expect(line).toContainText('10 disponibles');

  // Saving 6 writes only the delta (-1).
  await setQuantity(page, 0, 6);
  await page.getByRole('button', { name: 'Actualizar Pedido' }).click();
  await expect.poll(async () => (await inv.stock(product)).currentStock).toBe(4);
  expect((await inv.movements(product))[0].qty).toBe(-1);
});

test('O15 the figure follows other users without a reload', async ({ page, inv }) => {
  const product = await inv.product({ mode: 'recipe', stock: 10 });
  await openForm(page);
  await addProduct(page, product.name);
  const line = lineOf(page, product.name);
  await expect(line).toContainText('10 disponibles');

  // "Another tab": an order taking 4, then a stock adjustment of +5.
  await inv.order({ client: await inv.client(), lines: [{ product, quantity: 4, source: 'stock' }] });
  await expect(line).toContainText('6 disponibles', { timeout: 15_000 });

  await inv.stockUp(product, 5);
  await expect(line).toContainText('11 disponibles', { timeout: 15_000 });
});
