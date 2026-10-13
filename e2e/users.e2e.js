import { test, expect } from '@playwright/test';
import {
  USERS_ADMIN,
  STAFF_PASSWORD,
  login,
  loginAs,
  setPassword,
  uniqueUser,
  createClient,
  createStaff,
  editRole,
  expectListed,
  expectNotListed,
  expectLoginRejected,
  findRow,
} from './helpers.js';

const CLIENTS = '/dashboard/users';
const STAFF = '/dashboard/staff';
const B2B = '/dashboard/b2b-clients';

test.beforeEach(async ({ page }) => {
  await login(page, USERS_ADMIN);
  await expect(page).toHaveURL(/\/dashboard/);
});

// Creates staff through the UI, then gives them a known password.
const newStaff = async (page, request, kind) => {
  const user = uniqueUser(kind);
  await createStaff(page, kind, user);
  await expect(page).toHaveURL(new RegExp(`${STAFF}$`));
  await setPassword(request, user.email);
  return { user, credentials: { email: user.email, password: STAFF_PASSWORD } };
};

test.describe('create', () => {
  test('Persona appears in clients, not in staff', async ({ page }) => {
    const user = uniqueUser('Persona');
    await createClient(page, 'Persona', user);
    await expect(page).toHaveURL(new RegExp(`${CLIENTS}$`));

    await expectListed(page, CLIENTS, user.name);
    await expectNotListed(page, STAFF, user.name);
  });

  test('Empresa appears in clients and in B2B', async ({ page }) => {
    const user = uniqueUser('Empresa');
    await createClient(page, 'Empresa', user);

    await expectListed(page, CLIENTS, user.name);
    await expectListed(page, B2B, user.name);
  });

  test('Supervisor appears in staff, not in clients, and can log in', async ({ page, request, browser }) => {
    const { user, credentials } = await newStaff(page, request, 'Supervisor');

    await expectListed(page, STAFF, user.name);
    await expectNotListed(page, CLIENTS, user.name);

    const staffPage = await loginAs(browser, credentials);
    await expect(staffPage).toHaveURL(/\/dashboard/);
  });

  test('duplicate email is rejected by the backend', async ({ page }) => {
    const user = uniqueUser('Persona');
    await createClient(page, 'Persona', user);
    await expect(page).toHaveURL(new RegExp(`${CLIENTS}$`));

    await createClient(page, 'Persona', { ...uniqueUser('Persona'), email: user.email }, { stay: true });
    await expect(page).toHaveURL(/create-client/);
    await expect(page.getByText(/already exists|ya existe/i)).toBeVisible();
  });
});

test.describe('role moves', () => {
  test('client -> Supervisor can log in and moves lists', async ({ page, request, browser }) => {
    const user = uniqueUser('Persona');
    await createClient(page, 'Persona', user);

    await editRole(page, { path: CLIENTS, name: user.name, kind: 'Supervisor' });

    await expectNotListed(page, CLIENTS, user.name);
    await expectListed(page, STAFF, user.name);

    await setPassword(request, user.email);
    const staffPage = await loginAs(browser, { email: user.email, password: STAFF_PASSWORD });
    await expect(staffPage).toHaveURL(/\/dashboard/);
  });

  test('Supervisor -> Persona moves lists and revokes login', async ({ page, request, browser }) => {
    test.fail(true, 'Backend keeps the Auth account when staff become clients');

    const { user, credentials } = await newStaff(page, request, 'Supervisor');
    await editRole(page, { path: STAFF, name: user.name, kind: 'Persona' });

    await expectListed(page, CLIENTS, user.name);
    await expectNotListed(page, STAFF, user.name);

    await expectLoginRejected(await loginAs(browser, credentials));
  });

  test('round trip client -> staff -> client -> staff ends as one working staff member', async ({ page, request, browser }) => {
    const user = uniqueUser('Persona');
    await createClient(page, 'Persona', user);

    await editRole(page, { path: CLIENTS, name: user.name, kind: 'Supervisor' });
    await editRole(page, { path: STAFF, name: user.name, kind: 'Persona' });
    await editRole(page, { path: CLIENTS, name: user.name, kind: 'Supervisor' });

    await page.goto(STAFF);
    await expect(await findRow(page, user.name)).toHaveCount(1);
    await expectNotListed(page, CLIENTS, user.name);

    await setPassword(request, user.email);
    const staffPage = await loginAs(browser, { email: user.email, password: STAFF_PASSWORD });
    await expect(staffPage).toHaveURL(/\/dashboard/);
  });

  test('Persona -> Empresa joins B2B; Empresa -> Persona leaves it', async ({ page }) => {
    test.fail(true, 'Backend never deletes the b2b_clients doc when a company becomes a person');

    const user = uniqueUser('Persona');
    await createClient(page, 'Persona', user);
    await expectNotListed(page, B2B, user.name);

    await editRole(page, { path: CLIENTS, name: user.name, kind: 'Empresa' });
    await expectListed(page, B2B, user.name);

    await editRole(page, { path: CLIENTS, name: user.name, kind: 'Persona' });
    await expectNotListed(page, B2B, user.name);
  });
});

test.describe('role access', () => {
  const sidebar = (page) => page.getByRole('main').getByRole('navigation').getByRole('link');

  test('delivery assistant only sees the driver area', async ({ page, request, browser }) => {
    const { credentials } = await newStaff(page, request, 'Asistente Domicilio');
    const driver = await loginAs(browser, credentials);

    await expect(driver).toHaveURL(/\/driver\/orders/);
    await expect(sidebar(driver)).toHaveText(['Resumen', 'Pedidos']);

    for (const forbidden of ['/dashboard/orders', '/dashboard/users', '/accounting/salesReport', '/production/single', '/system-admin']) {
      await driver.goto(forbidden);
      await expect(driver, forbidden).toHaveURL(/\/driver\/orders/);
    }
  });

  test('production assistant only sees the production area', async ({ page, request, browser }) => {
    const { credentials } = await newStaff(page, request, 'Asistente Produccion');
    const production = await loginAs(browser, credentials);

    await expect(production).toHaveURL(/\/production\/single/);
    await expect(sidebar(production)).toHaveText(['Por Producto', 'Agrupado', 'Entrega', 'Calendario']);

    for (const forbidden of ['/dashboard/orders', '/dashboard/users', '/accounting/salesReport', '/driver/orders', '/system-admin']) {
      await production.goto(forbidden);
      await expect(production, forbidden).toHaveURL(/\/production\//);
    }
  });
});

test.describe('delete', () => {
  test('deleting staff removes the row and revokes login; deleting a client removes the row', async ({ page, request, browser }) => {
    const { user, credentials } = await newStaff(page, request, 'Supervisor');
    const client = uniqueUser('Persona');
    await createClient(page, 'Persona', client);

    await page.goto(STAFF);
    await (await findRow(page, user.name)).click();
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();
    await expectNotListed(page, STAFF, user.name);

    await expectLoginRejected(await loginAs(browser, credentials));

    page.once('dialog', (dialog) => dialog.accept());
    await page.goto(CLIENTS);
    await (await findRow(page, client.name)).click();
    await page.getByRole('button', { name: 'Eliminar' }).click();
    await expectNotListed(page, CLIENTS, client.name);
  });

  // The seed's bakery_admin shows in the staff list via the root users collection, not the staff subcollection.
  // The staff table's search matches `name` only, so the name has to match the seed (seed:e2e).
  test('admin row has no Editar action', async ({ page }) => {
    await page.goto(STAFF);
    await (await findRow(page, 'E2E Users Admin')).click();
    await expect(page.getByRole('button', { name: 'Restablecer Contraseña' })).toBeVisible(); // row is selected
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  });
});
