import { test, expect as baseExpect } from '@playwright/test';
import {
  USERS_ADMIN,
  login,
  uniqueName,
  setToggle,
  createCollection,
  createProduct,
  expectListed,
  expectNotListed,
  findRow,
  storedByName,
  LIST_API,
} from './helpers.js';

// The emulator takes seconds per list call once the bakery holds a few dozen docs.
const expect = baseExpect.configure({ timeout: 30000 });

const PRODUCTS = '/dashboard/products';
const COLLECTIONS = '/dashboard/product-collections';
const SIZE = { label: 'Forma / Tamaño', options: ['Pequeño', 'Grande'] };

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(180000);
  await login(page, USERS_ADMIN);
  await expect(page).toHaveURL(/\/dashboard/);
});

// A collection to put products in; its name is returned.
const newCollection = async (page, opts = {}) => {
  const name = uniqueName('col');
  await createCollection(page, { name, ...opts });
  return name;
};

// The edit form reads the collection list from the store. Opening it before that response lands
// leaves the Categoría select blank, and its required check then blocks the save.
const selectRow = async (page, path, name) => {
  const loaded = [path, ...(path === PRODUCTS ? [COLLECTIONS] : [])].map((p) =>
    page.waitForResponse((r) => r.request().method() === 'GET' && LIST_API[p].test(r.url())));
  await page.goto(path);
  await Promise.all(loaded);
  await (await findRow(page, name)).click();
};

const openEdit = async (page, path, name) => {
  await selectRow(page, path, name);
  await page.getByRole('button', { name: 'Editar' }).click();
  return page.getByRole('dialog');
};

// Deletes the selected row through window.confirm and resolves with the DELETE response.
const deleteRow = async (page, path, name, api) => {
  await selectRow(page, path, name);
  page.once('dialog', (dialog) => dialog.accept());
  const deleted = page.waitForResponse((r) => r.request().method() === 'DELETE' && api.test(r.url()));
  await page.getByRole('button', { name: 'Eliminar' }).click();
  return deleted;
};

const PRODUCT_API = /\/bakeries\/[^/]+\/products\/[^/]+$/;
const COLLECTION_API = /\/bakeries\/[^/]+\/productCollections\/[^/]+$/;

const taxCell = (row) => row.getByRole('cell').nth(-2); // IMP (%) is the column before Activo
const optionValues = (scope) => scope.getByPlaceholder('Nombre de la opción').evaluateAll((els) => els.map((e) => e.value));

// Waits for the PUT itself: the dialog locator is never 'visible' (its root has no box), so toBeHidden on it proves nothing.
const saveEdit = async (dialog, button, api) => {
  const saved = dialog.page().waitForResponse((r) => r.request().method() === 'PUT' && api.test(r.url()));
  await dialog.getByRole('button', { name: button }).click();
  expect((await saved).status()).toBe(200);
  await expect(dialog.getByRole('button', { name: button })).toBeHidden();
};

test.describe('collections', () => {
  test('a plain collection is listed', async ({ page }) => {
    const name = await newCollection(page);
    await expectListed(page, COLLECTIONS, name);
  });

  test('a collection with a variation template keeps its dimension and options', async ({ page, request }) => {
    const name = await newCollection(page, { dimensions: [SIZE] });
    await expectListed(page, COLLECTIONS, name);

    const dialog = await openEdit(page, COLLECTIONS, name);
    expect(await optionValues(dialog)).toEqual(['Pequeño', 'Grande']);

    const stored = await storedByName(request, 'productCollections', name);
    expect(stored.dimensionTemplates.dimensions.map((d) => d.label)).toEqual([SIZE.label]);
  });

  test('editing name and description updates the list', async ({ page }) => {
    const name = await newCollection(page, { description: 'primera descripcion' });
    const renamed = uniqueName('renamed');

    const dialog = await openEdit(page, COLLECTIONS, name);
    await dialog.getByLabel('Nombre', { exact: true }).fill(renamed);
    await dialog.getByLabel('Descripción').fill('segunda descripcion');
    await saveEdit(dialog, 'Actualizar Categoría', COLLECTION_API);

    await expectListed(page, COLLECTIONS, renamed);
    await expect(page.getByRole('row').filter({ hasText: renamed })).toContainText('segunda descripcion', { ignoreCase: true });
    await expectNotListed(page, COLLECTIONS, name);
  });

  test('an empty collection can be deleted', async ({ page }) => {
    const name = await newCollection(page);
    const response = await deleteRow(page, COLLECTIONS, name, COLLECTION_API);
    expect(response.status()).toBe(204);
    await expectNotListed(page, COLLECTIONS, name);
  });

  test('a collection with an active product cannot be deleted until the product is', async ({ page }) => {
    const collection = await newCollection(page);
    const product = uniqueName('prod');
    await createProduct(page, { name: product, collection, basePrice: 3000 });

    const blocked = await deleteRow(page, COLLECTIONS, collection, COLLECTION_API);
    expect(blocked.status()).toBe(400);
    await expectListed(page, COLLECTIONS, collection);

    const removed = await deleteRow(page, PRODUCTS, product, PRODUCT_API);
    expect(removed.status()).toBe(204);

    const freed = await deleteRow(page, COLLECTIONS, collection, COLLECTION_API);
    expect(freed.status()).toBe(204);
    await expectNotListed(page, COLLECTIONS, collection);
  });

  test('renaming a collection renames it on its products', async ({ page }) => {
    test.fail(true, 'Backend keeps the old collectionName denormalised on products');

    const collection = await newCollection(page);
    const product = uniqueName('prod');
    await createProduct(page, { name: product, collection, basePrice: 3000 });

    const renamed = uniqueName('renamed');
    const dialog = await openEdit(page, COLLECTIONS, collection);
    await dialog.getByLabel('Nombre', { exact: true }).fill(renamed);
    await saveEdit(dialog, 'Actualizar Categoría', COLLECTION_API);

    await expectListed(page, PRODUCTS, product);
    await expect(page.getByRole('row').filter({ hasText: product })).toContainText(renamed, { ignoreCase: true });
  });
});

test.describe('products without variations', () => {
  test('no tax: tax column is 0 and the prices show', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, basePrice: 5000, costPrice: 2000 });

    await expectListed(page, PRODUCTS, name);
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText(collection, { ignoreCase: true });
    await expect(taxCell(row)).toHaveText('0');
    await expect(row).toContainText(/5[.,]000/);

    const stored = await storedByName(request, 'products', name);
    expect(stored).toMatchObject({ basePrice: 5000, costPrice: 2000, taxPercentage: 0, hasVariations: false });
  });

  test('with tax: 19 is shown and stored', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, basePrice: 5000, tax: 19 });

    await expectListed(page, PRODUCTS, name);
    await expect(taxCell(page.getByRole('row').filter({ hasText: name }))).toHaveText('19');
    expect((await storedByName(request, 'products', name)).taxPercentage).toBe(19);
  });

  test('tax is rounded to one decimal', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, basePrice: 5000, tax: 19.55 });

    await expectListed(page, PRODUCTS, name);
    await expect(taxCell(page.getByRole('row').filter({ hasText: name }))).toHaveText('19.6');
    expect((await storedByName(request, 'products', name)).taxPercentage).toBe(19.6);
  });

  test('editing name, price and tax persists', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, basePrice: 5000 });
    const renamed = uniqueName('renamed');

    const dialog = await openEdit(page, PRODUCTS, name);
    await dialog.getByLabel('Nombre', { exact: true }).fill(renamed);
    await dialog.getByLabel('Precio de Venta').fill('6500');
    await dialog.getByLabel('Porcentaje de Impuesto').fill('8');
    await saveEdit(dialog, 'Actualizar Producto', PRODUCT_API);

    await expectListed(page, PRODUCTS, renamed);
    const row = page.getByRole('row').filter({ hasText: renamed });
    await expect(taxCell(row)).toHaveText('8');
    await expect(row).toContainText(/6[.,]500/);
    await expectNotListed(page, PRODUCTS, name);
    expect(await storedByName(request, 'products', renamed)).toMatchObject({ basePrice: 6500, taxPercentage: 8 });
  });

  test('deactivating a product persists', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, basePrice: 5000 });

    const dialog = await openEdit(page, PRODUCTS, name);
    await setToggle(dialog, 'Producto activo', 'No');
    await saveEdit(dialog, 'Actualizar Producto', PRODUCT_API);

    expect((await storedByName(request, 'products', name)).isActive).toBe(false);
  });

  test('deleting a product removes the row', async ({ page }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, basePrice: 5000 });

    const response = await deleteRow(page, PRODUCTS, name, PRODUCT_API);
    expect(response.status()).toBe(204);
    await expectNotListed(page, PRODUCTS, name);
  });
});

test.describe('products with variations', () => {
  test('one dimension: each option is a combination with its own prices', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, {
      name,
      collection,
      variations: [SIZE],
      prices: { Pequeño: [4000, 1500], Grande: [7000, 3000] },
    });

    await expectListed(page, PRODUCTS, name);
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('Pequeño');
    await expect(row).toContainText('Grande');

    const { variations, hasVariations } = await storedByName(request, 'products', name);
    expect(hasVariations).toBe(true);
    expect(variations.combinations.map((c) => [c.name, c.basePrice, c.costPrice])).toEqual(
      expect.arrayContaining([['Pequeño', 4000, 1500], ['Grande', 7000, 3000]]),
    );

    const dialog = await openEdit(page, PRODUCTS, name);
    await expect(page.locator('.group-header').filter({ hasText: 'Grande' }).locator('input[type=number]').first()).toHaveValue('7000');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('two dimensions generate every combination', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, {
      name,
      collection,
      variations: [SIZE, { label: 'Sabor', options: ['Vainilla', 'Chocolate'], custom: true }],
      prices: { Pequeño: [4000, 1500], Grande: [7000, 3000] }, // group rows set every variant under them
    });

    const { variations } = await storedByName(request, 'products', name);
    expect(variations.dimensions).toHaveLength(2);
    expect(variations.combinations).toHaveLength(4);
    expect(variations.combinations.filter((c) => c.basePrice === 4000)).toHaveLength(2);
    expect(variations.combinations.filter((c) => c.basePrice === 7000)).toHaveLength(2);

    await expectListed(page, PRODUCTS, name);
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('Vainilla');
    await expect(row).toContainText('Chocolate');
  });

  test('variations with tax keep the tax on the product', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, tax: 19, variations: [SIZE], prices: { Pequeño: [4000], Grande: [7000] } });

    await expectListed(page, PRODUCTS, name);
    await expect(taxCell(page.getByRole('row').filter({ hasText: name }))).toHaveText('19');
    const stored = await storedByName(request, 'products', name);
    expect(stored.taxPercentage).toBe(19);
    expect(stored.variations.combinations).toHaveLength(2);
  });

  test('editing a combination price and adding an option persists', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, variations: [SIZE], prices: { Pequeño: [4000], Grande: [7000] } });

    const dialog = await openEdit(page, PRODUCTS, name);
    await page.locator('.group-header').filter({ hasText: 'Grande' }).locator('input[type=number]').first().fill('7500');
    await dialog.getByRole('button', { name: 'Agregar Opción' }).click();
    await dialog.getByPlaceholder('Nombre de la opción').nth(2).fill('Mediano');
    await page.locator('.group-header').filter({ hasText: 'Mediano' }).locator('input[type=number]').first().fill('5500');
    await saveEdit(dialog, 'Actualizar Producto', PRODUCT_API);

    const { variations } = await storedByName(request, 'products', name);
    expect(variations.combinations.map((c) => [c.name, c.basePrice])).toEqual(
      expect.arrayContaining([['Pequeño', 4000], ['Grande', 7500], ['Mediano', 5500]]),
    );
    expect(variations.combinations).toHaveLength(3);
  });

  test('turning variations off asks first; confirming drops them, cancelling keeps them', async ({ page, request }) => {
    const collection = await newCollection(page);
    const name = uniqueName('prod');
    await createProduct(page, { name, collection, variations: [SIZE], prices: { Pequeño: [4000], Grande: [7000] } });

    const dialog = await openEdit(page, PRODUCTS, name);
    const confirm = page.getByRole('dialog').filter({ hasText: 'Eliminar variaciones' }).last();

    await setToggle(dialog, '¿Este producto tiene variaciones?', 'No');
    await confirm.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.locator('.group-header').filter({ hasText: 'Grande' })).toBeVisible();

    await setToggle(dialog, '¿Este producto tiene variaciones?', 'No');
    await confirm.getByRole('button', { name: 'Confirmar' }).click();
    await dialog.getByLabel('Precio de Venta').fill('6000');
    await saveEdit(dialog, 'Actualizar Producto', PRODUCT_API);

    const stored = await storedByName(request, 'products', name);
    expect(stored).toMatchObject({ hasVariations: false, basePrice: 6000 });
    expect(stored.variations.combinations ?? []).toHaveLength(0);
  });

  test('a collection template prefills the product variations', async ({ page, request }) => {
    const collection = await newCollection(page, { dimensions: [SIZE] });
    const name = uniqueName('prod');

    await page.goto('/dashboard/products/create');
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await page.getByLabel('Categoría').selectOption({ label: collection });

    const card = page.locator('.base-card').filter({ has: page.getByRole('heading', { level: 5, name: SIZE.label }) });
    await expect.poll(() => optionValues(card)).toEqual(['Pequeño', 'Grande']);

    await page.locator('.group-header').filter({ hasText: 'Pequeño' }).locator('input[type=number]').first().fill('4000');
    await page.locator('.group-header').filter({ hasText: 'Grande' }).locator('input[type=number]').first().fill('7000');
    await page.getByRole('button', { name: 'Crear Producto' }).click();
    await expect(page).toHaveURL(/\/dashboard\/products$/);

    const { variations } = await storedByName(request, 'products', name);
    expect(variations.combinations.map((c) => [c.name, c.basePrice])).toEqual(
      expect.arrayContaining([['Pequeño', 4000], ['Grande', 7000]]),
    );
  });
});
