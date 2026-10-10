import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, f] = await Promise.all([import('@node-rs/argon2'), import('../factories/database')]);
  await f.resetDatabase();
  await f.createUser({name: 'Administrateur Mobile', phoneE164: '+22221234567', pinHash: await hash('1234'), role: 'ADMIN'});
});

test('no page scrolls sideways on a phone and the dashboard leaves logout to "more"', async ({page}) => {
  test.setTimeout(120000);
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await expect(page.locator('.dashboard-logout')).toBeHidden();

  const wide: string[] = [];
  for (const locale of ['ar', 'fr']) {
    for (const path of ['dashboard', 'sales', 'expenses', 'stock', 'shifts', 'employees', 'medicines', 'reports', 'audit', 'settings', 'more']) {
      await page.goto(`/${locale}/${path}`);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      if (width > 390) wide.push(`${locale}/${path}: ${width}px`);
    }
  }
  expect(wide).toEqual([]);
});
