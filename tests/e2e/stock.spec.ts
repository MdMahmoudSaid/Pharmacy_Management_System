import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  process.loadEnvFile('.env.test');
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
  const medicineForm = page.getByTestId('medicine-form');
  await medicineForm.locator('[name="name"]').fill('Paracétamol UI');
  await medicineForm.locator('[name="code"]').fill('P-UI');
  await medicineForm.locator('[name="sellingPrice"]').fill('25.50');
  await medicineForm.getByRole('button', {name: 'إضافة الدواء'}).click();
  await expect(page.getByText('Paracétamol UI')).toBeVisible();

  await page.goto('/ar/shifts');
  await page.getByRole('button', {name: 'فتح المناوبة'}).click();
  await page.goto('/ar/stock');
  const receipt = page.getByTestId('receive-stock-form');
  await receipt.locator('[name="medicineId"]').selectOption({label: 'Paracétamol UI'});
  await receipt.locator('[name="quantity"]').fill('20');
  page.once('dialog', (dialog) => dialog.accept());
  await receipt.getByRole('button', {name: 'تأكيد الاستلام'}).click();
  await expect(receipt.getByText('تم تسجيل الاستلام.')).toBeVisible();
  await expect(page.getByText('0 +20 = 20')).toBeVisible();

  await page.goto('/ar/medicines');
  const card = page.locator('.medicine-card').filter({hasText: 'Paracétamol UI'});
  await card.locator('.inline-sensitive-form [name="reason"]').fill('Produit retiré');
  await card.getByRole('button', {name: 'أرشفة'}).click();
  await expect(card.getByRole('button', {name: 'استعادة'})).toBeVisible();

  await page.goto('/ar/stock');
  await expect(page.locator('option', {hasText: 'Paracétamol UI'})).toHaveCount(0);
  await expect(page.getByText('Paracétamol UI')).toBeVisible();
  await expect(page.getByText('0 +20 = 20')).toBeVisible();
});
