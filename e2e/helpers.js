import { expect } from '@playwright/test';

// Admin of the empty `e2e-users` bakery, created by `npm run seed:e2e` in the backend's functions/ (emulator only).
export const USERS_ADMIN = { email: 'admin-users@e2e.test', password: 'e2e-users' };
export const STAFF_PASSWORD = 'e2e-secret-1';

const AUTH_EMULATOR = 'http://localhost:9099/identitytoolkit.googleapis.com/v1';
const OWNER = { Authorization: 'Bearer owner' };

let counter = 0;

// Unique per call so reruns against the same emulator never collide on email.
export const uniqueUser = (kind) => {
  const id = `${Date.now()}-${++counter}`;
  return { name: `E2E ${kind} ${id}`, email: `e2e-${id}@example.com`, phone: '' };
};

export const login = async (page, { email, password }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.locator('button[type=submit]').click();
};

// The backend derives staff passwords internally; set a known one through the Auth emulator.
export const setPassword = async (request, email, password = STAFF_PASSWORD) => {
  const lookup = await request.post(`${AUTH_EMULATOR}/accounts:lookup`, {
    headers: OWNER,
    data: { email: [email] },
  });
  const { users } = await lookup.json();
  expect(users, `no Auth account for ${email}`).toHaveLength(1);

  const update = await request.post(`${AUTH_EMULATOR}/accounts:update`, {
    headers: OWNER,
    data: { localId: users[0].localId, password },
  });
  expect(update.ok()).toBe(true);
};

// kind: label of the radio pill, e.g. 'Persona', 'Empresa', 'Supervisor', 'Asistente Domicilio'.
// Waits for the redirect so the next navigation can't cancel the create request; `stay` skips that for rejection tests.
export const createUser = async (page, { path, kind, user, stay = false }) => {
  await page.goto(path);
  await page.getByLabel('Nombre', { exact: true }).fill(user.name);
  await page.getByLabel('Correo Electrónico').fill(user.email);
  await page.getByText(kind, { exact: true }).click();
  await page.getByRole('button', { name: 'Crear Usuario' }).click();
  if (!stay) await expect(page).not.toHaveURL(/\/create-/);
};

export const createClient = (page, kind, user, opts) =>
  createUser(page, { path: '/dashboard/users/create-client', kind, user, ...opts });

export const createStaff = (page, kind, user, opts) =>
  createUser(page, { path: '/dashboard/users/create-staff', kind, user, ...opts });

// A revoked or unknown account stays on the login form with the error alert showing.
export const expectLoginRejected = (page) => expect(page.locator('.text-danger')).toBeVisible();

// Row on a DataTable page, found through the search box.
export const findRow = async (page, text) => {
  const main = page.getByRole('main');
  const search = main.locator('input[type=text]').first();
  if (!(await search.isVisible())) {
    await main.locator('button:has(svg):visible').first().click(); // magnifier toggle in the table toolbar
  }
  await search.fill(text);
  return page.getByRole('row').filter({ hasText: text });
};

export const expectListed = async (page, path, name) => {
  await page.goto(path);
  await expect(await findRow(page, name)).toBeVisible();
};

// Each list page loads from its own endpoint (settings/default is fetched too, but is not the table's data).
// Waiting for that response, plus the empty-state message, keeps a still-loading table from passing as "not listed".
export const LIST_API = {
  '/dashboard/users': /\/bakeries\/[^/]+\/users(\?|$)/,
  '/dashboard/staff': /\/settings\/default\/staff$/,
  '/dashboard/b2b-clients': /\/settings\/default\/b2b_clients$/,
  '/dashboard/products': /\/bakeries\/[^/]+\/products(\?|$)/,
  '/dashboard/product-collections': /\/bakeries\/[^/]+\/productCollections(\?|$)/,
};

export const expectNotListed = async (page, path, name) => {
  const loaded = page.waitForResponse((r) => r.request().method() === 'GET' && LIST_API[path].test(r.url()));
  await page.goto(path);
  await loaded;
  await expect(await findRow(page, name)).toHaveCount(0);
  await expect(page.getByText('No hay datos disponibles para mostrar.')).toBeVisible();
};

// Selects the row, opens the edit dialog, picks a new type pill and saves.
export const editRole = async (page, { path, name, kind }) => {
  await page.goto(path);
  const row = await findRow(page, name);
  await row.click();
  await page.getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText(kind, { exact: true }).click();
  await dialog.getByRole('button', { name: 'Actualizar Usuario' }).click();
  await expect(dialog).toBeHidden();
};

// Products and collections are stored lowercase, so the names are lowercase from the start.
export const uniqueName = (kind) => `e2e ${kind} ${Date.now()}-${++counter}`;

// UiYesNo's label is a sibling of its radiogroup, not tied to it; the visible
// Sí/No are <label>s next to sr-only radios, so click the text.
export const setToggle = (scope, label, answer) =>
  scope.getByText(label, { exact: true }).locator('xpath=following-sibling::div').getByText(answer, { exact: true }).click();

// The block of one variation dimension, found by its title (e.g. 'Forma / Tamaño').
export const dimensionCard = (page, label) =>
  page.locator('section').filter({ has: page.locator('.ui-card-title', { hasText: label }) });

// Adds a fixed dimension pill (or a custom one when `custom`) and fills its options in order.
export const addDimension = async (page, { label, options, custom = false }) => {
  if (custom) {
    await page.getByPlaceholder('ej: Sabor, Color, Material...').fill(label);
    await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  } else {
    await page.getByText(label, { exact: true }).click();
  }
  const card = dimensionCard(page, label);
  for (const [i, name] of options.entries()) {
    await card.getByRole('button', { name: 'Agregar Opción' }).click();
    await card.getByPlaceholder('Nombre de la opción').nth(i).fill(name);
  }
};

// Row of the price table for one single-dimension option; [sale, cost] number inputs follow its name.
export const priceRow = (page, optionName) =>
  page.locator('.ui-item-filled').filter({ has: page.locator('.ui-item-title', { hasText: optionName }) });

export const createCollection = async (page, { name, description, dimensions = [], stay = false }) => {
  await page.goto('/dashboard/product-collections/create');
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  if (description) await page.getByLabel('Descripción').fill(description);
  if (dimensions.length) {
    await setToggle(page, '¿Los productos de esta categoria tendran variaciones?', 'Sí');
    for (const dimension of dimensions) await addDimension(page, dimension);
  }
  await page.getByRole('button', { name: 'Crear Categoría' }).click();
  if (!stay) await expect(page).not.toHaveURL(/\/create/);
};

// variations: [{ label, options: [names], custom? }]; prices: { optionName: [sale, cost] } for single-dimension products.
export const createProduct = async (page, { name, collection, basePrice, costPrice, tax, variations = [], prices = {}, stay = false }) => {
  await page.goto('/dashboard/products/create');
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  await page.getByLabel('Categoría').selectOption({ label: collection });
  if (tax !== undefined) await page.getByLabel('Porcentaje de Impuesto').fill(String(tax));
  if (variations.length) {
    if (!(await page.getByLabel('Crear variación personalizada').isVisible())) {
      await setToggle(page, '¿Este producto tiene variaciones?', 'Sí');
    }
    for (const variation of variations) await addDimension(page, variation);
    for (const [option, [sale, cost]] of Object.entries(prices)) {
      const inputs = priceRow(page, option).locator('input[inputmode=numeric]');
      await inputs.nth(0).fill(String(sale));
      if (cost !== undefined) await inputs.nth(1).fill(String(cost));
    }
  } else {
    await page.getByLabel('Precio de Venta').fill(String(basePrice));
    if (costPrice !== undefined) await page.getByLabel('Precio de Costo').fill(String(costPrice));
  }
  await page.getByRole('button', { name: 'Crear Producto' }).click();
  if (!stay) await expect(page).toHaveURL(/\/dashboard\/products$/); // redirect comes 1.2s after the toast
};

// Firestore REST wraps every value in a type tag; this unwraps it to plain JS.
const decode = (v) => {
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  return Object.values(v)[0];
};

// Reads the stored docs of a `e2e-users` collection (e.g. 'products') straight from the emulator.
export const storedDocs = async (request, collection, bakery = 'e2e-users') => {
  const res = await request.get(`http://localhost:8080/v1/projects/bake-ry/databases/(default)/documents/bakeries/${bakery}/${collection}?pageSize=300`, { headers: OWNER });
  const { documents = [] } = await res.json();
  return documents.map((d) => ({ id: d.name.split('/').pop(), ...decode({ mapValue: { fields: d.fields } }) }));
};

export const storedByName = async (request, collection, name) =>
  (await storedDocs(request, collection)).find((d) => d.name === name);

// Logs in as someone in a fresh browser context and returns their page.
export const loginAs = async (browser, credentials) => {
  const context = await browser.newContext({ baseURL: 'http://localhost:5173' }); // fixtures' use{} doesn't reach manual contexts
  const page = await context.newPage();
  await login(page, credentials);
  return page;
};
