import { test, expect } from '@playwright/test';

// Seeded admin from the backend's seeds/data/bakery.js (emulator only).
const ADMIN = { email: 'es.alimento@gmail.com', password: 'alimento' };

test('admin logs in and browses the main screens', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.locator('button[type=submit]').click();

  await expect(page).toHaveURL(/\/dashboard/);

  for (const path of ['products', 'users', 'inventory', 'ingredients']) {
    await page.goto(`/dashboard/${path}`);
    await expect(page).toHaveURL(new RegExp(`/dashboard/${path}`));
    await expect(page.getByRole('main')).not.toBeEmpty();
    await page.screenshot({ path: `e2e/screens/${path}.png`, fullPage: true });
  }
});
