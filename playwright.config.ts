import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
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
