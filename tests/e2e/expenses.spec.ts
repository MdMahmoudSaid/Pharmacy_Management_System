import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  process.loadEnvFile('.env.test');
  const [{hash}, factories] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Dépenses',
    phoneE164: '+22221234567',
    pinHash: await hash('1234'),
    role: 'ADMIN'
  });
  await factories.createShift({userId: admin.id});
});

test('creates, corrects, filters, and cancels an expense', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/ar/expenses');

  const create = page.getByTestId('expense-form');
  await create.locator('[name="amount"]').fill('500.00');
  await create.locator('[name="description"]').fill('نقل المورد');
  await create.getByRole('button', {name: 'تسجيل المصروف'}).click();
  await expect(page.getByText('تم تسجيل المصروف.')).toBeVisible();

  const row = page.locator('.expense-row').filter({hasText: 'نقل المورد'});
  await expect(row.getByText('500.00 MRU')).toBeVisible();
  await row.getByText('تصحيح', {exact: true}).click();
  const correction = row.locator('details form');
  await correction.locator('[name="amount"]').fill('300.00');
  await correction.locator('[name="reason"]').fill('خطأ في المبلغ');
  await correction.getByRole('button', {name: 'حفظ التصحيح'}).click();
  await expect(row.getByText('300.00 MRU')).toBeVisible();

  await row.locator('.cancel-expense-form [name="reason"]').fill('تم الإلغاء');
  await row.getByRole('button', {name: 'إلغاء', exact: true}).click();
  await expect(row.getByText('ملغى', {exact: true})).toBeVisible();

  const [{db}, {expenses}] = await Promise.all([
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  const stored = await db.select().from(expenses);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({amount: '300.00', status: 'CANCELLED'});
});
