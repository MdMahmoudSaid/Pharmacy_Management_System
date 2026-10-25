import {loadEnvFile} from 'node:process';

import {defineConfig, devices} from '@playwright/test';

if (!process.env.DATABASE_URL || !process.env.AUTH_FINGERPRINT_SECRET) {
  loadEnvFile('.env.test');
}

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure'
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'mobile-chromium', use: {...devices['Pixel 7']}}
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: `http://127.0.0.1:${port}/ar`,
    reuseExistingServer: !process.env.CI
  }
});
