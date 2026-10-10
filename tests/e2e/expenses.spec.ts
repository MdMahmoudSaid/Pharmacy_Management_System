import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
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

test('creates a category inline, then corrects and cancels an expense', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/ar/expenses');
  await page.locator('.form-collapse > summary').click();

  const create = page.getByTestId('expense-form');
  const category = create.getByRole('combobox', {name: 'الفئة'});
  await category.click();
  await category.fill('نقل');
  await create.getByRole('option', {name: 'إضافة «نقل»'}).click();
  await expect(category).toHaveValue('نقل');
  await create.locator('[name="amount"]').fill('500.00');
  await create.locator('[name="description"]').fill('نقل المورد');
  await create.getByRole('button', {name: 'إضافة مصروف'}).click();
  await expect(page.getByText('تم تسجيل المصروف.')).toBeVisible();

  const row = page.locator('.expense-row').filter({hasText: 'نقل المورد'});
  await expect(row.getByText('نقل', {exact: true})).toBeVisible();
  await expect(row.getByText('−500.00 MRU')).toBeVisible();
  await expect(page.locator('.expense-total')).toContainText('500.00');
  await row.getByText('تصحيح', {exact: true}).click();
  const correction = row.locator('details form');
  await correction.locator('[name="amount"]').fill('300.00');
  await correction.locator('[name="reason"]').fill('خطأ في المبلغ');
  await correction.getByRole('button', {name: 'حفظ التصحيح'}).click();
  await expect(row.getByText('−300.00 MRU')).toBeVisible();

  await row.locator('.cancel-expense-form [name="reason"]').fill('تم الإلغاء');
  await row.locator('.cancel-expense-form').getByRole('button', {name: 'إلغاء', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'تأكيد', exact: true}).click();
  await expect(row.getByText('ملغى', {exact: true})).toBeVisible();
  await expect(page.locator('.expense-total')).toContainText('0.00');

  const [{db}, {expenses}] = await Promise.all([
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  const stored = await db.select().from(expenses);
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({amount: '300.00', status: 'CANCELLED', description: 'نقل المورد'});
  expect(stored[0].categoryId).not.toBeNull();
});

test('manages expense categories from the settings page', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/ar/settings');

  const manager = page.locator('.expense-categories');
  await manager.getByRole('textbox', {name: 'اسم الفئة الجديدة'}).first().fill('كهرباء');
  await manager.getByRole('button', {name: 'إضافة'}).click();
  const row = manager.locator('.category-list li');
  await expect(row.locator('[name="name"]')).toHaveValue('كهرباء');

  await row.locator('[name="name"]').fill('الكهرباء والماء');
  await row.getByRole('button', {name: 'حفظ الاسم'}).click();
  await expect(row.getByText('تم الحفظ.')).toBeVisible();

  await row.getByRole('button', {name: /حذف/}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'تأكيد', exact: true}).click();
  await expect(manager.getByText('لا توجد فئات بعد.')).toBeVisible();

  await page.goto('/ar/expenses');
  await page.locator('.form-collapse > summary').click();
  const category = page.getByTestId('expense-form').getByRole('combobox', {name: 'الفئة'});
  await category.click();
  await expect(page.getByRole('option', {name: 'الكهرباء والماء'})).toHaveCount(0);
});
