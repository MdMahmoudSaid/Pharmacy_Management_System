import {loadEnvFile} from 'node:process';

import {defineConfig, devices} from '@playwright/test';

if (!process.env.DATABASE_URL || !process.env.AUTH_FINGERPRINT_SECRET) {
  loadEnvFile('.env.test');
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure'
  },
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'mobile-chromium', use: {...devices['Pixel 7']}}
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:3000/ar',
    reuseExistingServer: !process.env.CI
  }
});
