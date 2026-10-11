import {expect, test} from '@playwright/test';
import {eq} from 'drizzle-orm';

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
    role: 'ADMIN'
  });
});

async function login(page: import('@playwright/test').Page, phone: string, pin: string) {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill(phone);
  await page
    .getByRole('textbox', {name: 'الرمز السري', exact: true})
    .fill(pin);
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
}

test('filters navigation and rejects a forged employee-management action', async ({
  page
}) => {
  await login(page, '21234567', '1234');
  await page.goto('/ar/employees');
  await page.locator('.form-collapse > summary').click();

  const createForm = page.getByTestId('create-employee-form');
  const actionFields = await createForm.locator('input[type="hidden"]').evaluateAll(
    (inputs) =>
      inputs
        .map((input) => ({
          name: (input as HTMLInputElement).name,
          value: (input as HTMLInputElement).value
        }))
        .filter(({name}) => name.startsWith('$ACTION_'))
  );
  await createForm.locator('[name="name"]').fill('Employé Limité');
  await createForm.locator('[name="phone"]').fill('31234567');
  await createForm.locator('[name="pin"]').fill('5678');
  await createForm.getByRole('button', {name: 'إنشاء الحساب'}).click();
  const employeeCard = page.locator('.employee-row').filter({hasText: 'Employé Limité'});
  await expect(employeeCard).toBeVisible();

  await expect(createForm.locator('[name="name"]')).toHaveValue('');
  await expect(employeeCard.getByText('بدون صلاحيات')).toBeVisible();
  await employeeCard.getByText('إدارة الحساب').click();
  await employeeCard.getByRole('tab', {name: 'الصلاحيات'}).click();
  await employeeCard
    .locator('input[value="sales.correct.own"]')
    .check();
  await employeeCard.getByRole('button', {name: 'حفظ الصلاحيات'}).click();
  await expect(employeeCard.getByText('تم حفظ الصلاحيات.')).toBeVisible();
  await expect(employeeCard.getByText('صلاحية واحدة')).toBeVisible();

  await page.goto('/ar/dashboard');
  await page.getByRole('button', {name: 'تسجيل الخروج'}).click();
  await login(page, '31234567', '5678');

  await expect(page.getByRole('link', {name: 'المبيعات'}).first()).toBeVisible();
  await expect(page.getByRole('link', {name: 'المخزون'})).toHaveCount(0);
  await expect(page.getByRole('link', {name: 'الموظفون'})).toHaveCount(0);

  const forged = await page.evaluate(async (fields) => {
    const body = new FormData();
    for (const field of fields) body.append(field.name, field.value);
    body.set('locale', 'ar');
    body.set('name', 'Compte Interdit');
    body.set('phone', '41234567');
    body.set('pin', '9999');
    const response = await fetch('/ar/employees', {
      method: 'POST',
      body,
      redirect: 'manual'
    });
    return {status: response.status, body: await response.text()};
  }, actionFields);

  const [{db}, {users}] = await Promise.all([
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  const forbiddenUser = await db
    .select({id: users.id})
    .from(users)
    .where(eq(users.phoneE164, '+22241234567'));
  expect(forged.body).toContain('FORBIDDEN');
  expect(forbiddenUser).toEqual([]);
});
