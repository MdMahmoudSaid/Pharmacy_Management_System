import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, factories] = await Promise.all([import('@node-rs/argon2'), import('../factories/database')]);
  await factories.resetDatabase();
  const admin = await factories.createUser({name: 'Administrateur PWA', phoneE164: '+22221234567', pinHash: await hash('1234'), role: 'ADMIN'});
  await factories.createShift({userId: admin.id});
  await factories.createMedicine({name: 'Médicament Hors Ligne', currentStock: 5, sellingPrice: '10.00'});
});

test('exposes install metadata and never intercepts mutation requests', async ({page, request}) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({start_url: '/ar', display: 'standalone'});
  expect(manifest.icons.map((icon: {sizes: string}) => icon.sizes)).toEqual(['192x192', '512x512']);
  const worker = await (await request.get('/sw.js')).text();
  expect(worker).toContain("event.request.method !== 'GET'");
  await page.goto('/ar/offline');
  await expect(page.getByRole('heading', {name: 'أنت غير متصل'})).toBeVisible();
});

test('keeps an unsent sale draft and its idempotency key while offline', async ({page, context}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/ar/sales');
  await page.locator('.sale-medicine-results button').click();
  const key = await page.getByTestId('sale-idempotency-key').inputValue();
  await context.setOffline(true);
  await expect(page.getByTestId('offline-draft')).toBeVisible();
  await expect(page.getByRole('button', {name: 'تأكيد البيع'})).toBeDisabled();
  await expect(page.getByText(/تم تسجيل البيع/)).toHaveCount(0);
  expect(await page.getByTestId('sale-idempotency-key').inputValue()).toBe(key);
  await context.setOffline(false);
  await expect(page.getByTestId('offline-draft')).toHaveCount(0);
  expect(await page.getByTestId('sale-idempotency-key').inputValue()).toBe(key);
});
