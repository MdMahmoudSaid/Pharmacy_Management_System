import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, factories] = await Promise.all([import('@node-rs/argon2'), import('../factories/database')]);
  await factories.resetDatabase();
  const admin = await factories.createUser({name: 'Administrateur Accessibilité', phoneE164: '+22221234567', pinHash: await hash('1234'), role: 'ADMIN'});
  await factories.createShift({userId: admin.id});
  await factories.createMedicine({name: 'Test Accessibilité', currentStock: 5});
});

test('sampled Arabic pages have RTL direction and no serious axe violations', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  for (const path of ['dashboard', 'sales', 'stock']) {
    await page.goto(`/ar/${path}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const results = await new AxeBuilder({page}).analyze();
    expect(results.violations.filter(({impact}) => impact === 'serious' || impact === 'critical')).toEqual([]);
  }
});
