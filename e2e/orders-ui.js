import { expect } from '@playwright/test';
import { login } from './helpers.js';
import { ORDERS_ADMIN } from './orders-api.js';

// 10000 -> "$10,000" (formatMoney in src/utils/helpers.js)
export const money = (n) => `$${n.toLocaleString('en-US')}`;

export const loginAdmin = async (page) => {
  await login(page, ORDERS_ADMIN);
  await expect(page).toHaveURL(/\/dashboard/);
};

// Opens a dashboard page and moves its period forward with the real "Next Period" button.
// Each step waits for its own orders fetch: the page does not discard a response that arrives
// late, so with several fetches in flight the screen can end up on an earlier period's data.
export const openOn = async (page, path, { days = 0, months = 0 } = {}) => {
  const fetched = () => page.waitForResponse((r) => r.ok() && /\/orders(\/\w+)?\?/.test(r.url()));
  const firstFetch = fetched();
  await page.goto(path);
  await firstFetch;
  const next = page.getByRole('button', { name: 'Next Period' });
  // The label sits between the Previous and Next buttons. A click that lands while the table
  // re-renders is lost, and the test would silently look at the wrong period.
  const label = next.locator('xpath=preceding-sibling::span');
  for (let i = 0; i < days + months; i++) {
    const before = await label.textContent();
    const refetch = fetched();
    await next.click();
    await expect(label).not.toHaveText(before);
    await refetch;
  }
};

export const rowOf = (page, text) => page.getByRole('row').filter({ hasText: text });
