import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Same setup as the shared config, with its own artifact folders so it can run next to another suite
// (Playwright wipes `outputDir` at the start of every run) and one worker because the bakery is shared.
export default defineConfig({
  ...base,
  testMatch: '**/inventory*.e2e.js',
  testIgnore: [],
  outputDir: './e2e/results-inventory',
  reporter: [['list'], ['html', { outputFolder: 'e2e/report-inventory', open: 'never' }]],
});
