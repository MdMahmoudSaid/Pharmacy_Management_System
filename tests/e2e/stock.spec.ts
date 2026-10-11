import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, {createUser, resetDatabase}] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database')
  ]);
  await resetDatabase();
  await createUser({
    name: 'Administrateur Stock',
    phoneE164: '+22221234567',
    pinHash: await hash('1234'),
    role: 'ADMIN'
  });
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
}

test('receives stock once, archives selection, and keeps movement history', async ({
  page
}) => {
  await login(page);
  await page.goto('/ar/medicines');
  await page.locator('.form-collapse > summary').click();
  const medicineForm = page.getByTestId('medicine-form');
  await medicineForm.locator('[name="name"]').fill('Paracétamol UI');
  await medicineForm.locator('[name="code"]').fill('P-UI');
  await medicineForm.locator('[name="sellingPrice"]').fill('25.50');
  await medicineForm.getByRole('button', {name: 'إضافة الدواء'}).click();
  await expect(page.locator('.medicine-row-main').getByText('Paracétamol UI')).toBeVisible();

  await page.goto('/ar/shifts');
  await page.getByRole('button', {name: 'فتح المناوبة'}).click();
  await page.goto('/ar/stock');
  await page.locator('.form-collapse > summary').click();
  const receipt = page.getByTestId('receive-stock-form');
  const medicine = receipt.getByRole('combobox', {name: 'الدواء'});
  await medicine.click();
  await medicine.fill('Paracé');
  await receipt.getByRole('option', {name: /Paracétamol UI/}).click();
  await expect(medicine).toHaveValue('Paracétamol UI');
  await receipt.locator('[name="quantity"]').fill('20');
  await receipt.getByRole('button', {name: 'تأكيد الاستلام'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'تأكيد', exact: true}).click();
  await expect(receipt.getByText('تم تسجيل الاستلام.')).toBeVisible();
  const movement = page.locator('.movement-rows li').filter({hasText: 'Paracétamol UI'});
  await expect(movement.getByText('+20')).toBeVisible();
  await expect(movement.getByText('الرصيد 0 ← 20')).toBeVisible();
  await expect(movement.getByText(/استلام/)).toBeVisible();

  await page.goto('/ar/medicines');
  const row = page.locator('.medicine-row').filter({hasText: 'Paracétamol UI'});
  await expect(row.locator('.stock-badge')).toHaveText('20 وحدة');
  await row.getByText('تعديل', {exact: true}).click();
  await row.getByRole('button', {name: 'أرشفة'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'تأكيد', exact: true}).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', {name: /مؤرشف/}).click();
  const archived = page.locator('.medicine-row').filter({hasText: 'Paracétamol UI'});
  await expect(archived.locator('.stock-badge')).toHaveText('مؤرشف');

  await page.goto('/ar/stock');
  await page.locator('.form-collapse > summary').click();
  const picker = page.getByTestId('receive-stock-form').getByRole('combobox', {name: 'الدواء'});
  await picker.click();
  await expect(page.getByRole('option', {name: /Paracétamol UI/})).toHaveCount(0);
  await expect(page.locator('.movement-rows').getByText('Paracétamol UI')).toBeVisible();
});
