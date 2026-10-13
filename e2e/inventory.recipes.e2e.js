import { test, expect, loginAdmin } from './inventory-ui.js';

// BROWSER-CHECKS §8 (RC1-RC3, RC5, RC8). Costs are written by the backend's recipe walk, so these drive the
// API and read the documents back; the Existencias cost preview is covered by E4.
const product = (inv, id) => inv.call('GET', `/products/${id}`);

test('RC1 linking a recipe keeps a typed cost, and it stays manual', async ({ inv }) => {
  const flour = await inv.ingredient({ cost: 42 });
  const typed = await inv.product({ mode: 'recipe', costPrice: 3500 });
  await inv.addRecipe(typed, [{ ingredient: flour, quantity: 100 }]); // the recipe costs 4.200

  expect(await product(inv, typed.id)).toMatchObject({ costPrice: 3500, costPriceSource: 'manual' });
});

test('RC2 linking a recipe to a product with no cost takes the recipe cost', async ({ inv }) => {
  const flour = await inv.ingredient({ cost: 42 });
  const empty = await inv.product({ mode: 'recipe', costPrice: 0 });
  await inv.addRecipe(empty, [{ ingredient: flour, quantity: 100 }]);

  expect(await product(inv, empty.id)).toMatchObject({ costPrice: 4200, costPriceSource: 'recipe' });
});

test('RC3 an ingredient cost change moves recipe-sourced products and leaves manual ones', async ({ inv }) => {
  const flour = await inv.ingredient({ cost: 10 });
  const follows = await inv.product({ mode: 'recipe', costPrice: 0, recipe: [{ ingredient: flour, quantity: 100 }] });
  const manual = await inv.product({ mode: 'recipe', costPrice: 3500, recipe: [{ ingredient: flour, quantity: 100 }] });
  expect((await product(inv, follows.id)).costPrice).toBe(1000);

  const current = await inv.call('GET', `/ingredients/${flour.id}`);
  await inv.call('PUT', `/ingredients/${flour.id}`, { ...current, costPerUnit: 20 });

  await expect.poll(async () => (await product(inv, follows.id)).costPrice).toBe(2000);
  expect((await product(inv, manual.id)).costPrice).toBe(3500);
});

test('RC5 an ingredient used in a recipe cannot be deleted, an unused one can', async ({ inv }) => {
  const used = await inv.ingredient();
  const unused = await inv.ingredient();
  const made = await inv.product({ mode: 'recipe', recipe: [{ ingredient: used, quantity: 5 }] });

  await expect(inv.call('DELETE', `/ingredients/${used.id}`)).rejects.toThrow(new RegExp(made.name, 'i'));
  expect((await inv.call('GET', `/ingredients/${used.id}`)).isDeleted).toBeFalsy();

  await inv.call('DELETE', `/ingredients/${unused.id}`);
  expect((await inv.call('GET', `/ingredients/${unused.id}`)).isDeleted).toBe(true); // a soft delete
});

test('RC8 there is no create-ingredient page', async ({ page }) => {
  await loginAdmin(page);
  await page.goto('/dashboard/ingredients/create');
  await expect(page.getByText(/En construcción/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible(); // the app loaded
  await expect(page.locator('form, input')).toHaveCount(0); // and offers nothing to fill in
});
