import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, {createUser, resetDatabase}] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database')
  ]);
  await resetDatabase();
  await createUser({
    name: 'Administrateur Test',
    phoneE164: '+22221234567',
    pinHash: await hash('1234'),
    role: 'ADMIN',
    preferredLocale: 'ar'
  });
});

test('logs in in Arabic, switches to French, and preserves it on logout', async ({
  page
}) => {
  await page.goto('/ar/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('+222', {exact: true})).toBeVisible();

  const pin = page.getByRole('textbox', {name: 'الرمز السري', exact: true});
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await pin.fill('1234');
  await expect(pin).toHaveAttribute('type', 'password');
  await page.getByRole('button', {name: 'إظهار الرمز السري'}).click();
  await expect(pin).toHaveAttribute('type', 'text');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();

  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await expect(page.getByRole('heading', {name: 'تم تسجيل الدخول بنجاح'})).toBeVisible();
  await page.getByRole('button', {name: 'fr', exact: true}).click();

  await expect(page).toHaveURL(/\/fr\/dashboard$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', {name: 'Déconnexion'}).click();

  await expect(page).toHaveURL(/\/fr\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(
    page.getByRole('heading', {name: 'Heureux de vous revoir'})
  ).toBeVisible();
});
