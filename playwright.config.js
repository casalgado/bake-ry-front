import { defineConfig } from '@playwright/test';

// Runs against the local Vite server + Firebase emulators (VITE_USE_AUTH_EMULATOR=true in .env).
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  testIgnore: '**/inventory*.e2e.js', // its own suite and config: `npm run e2e:inventory`
  outputDir: './e2e/results',
  workers: 1, // one emulator-backed API; parallel workers make its latency, and the tests, flaky
  timeout: 90_000, // slowMo makes every action cost; the emulator-backed API is not fast
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    // Recording every test exhausts memory on a full run. Pass --video=on to bring video back for one run.
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'retain-on-failure',
    launchOptions: { slowMo: Number(process.env.SLOWMO) || 0 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
