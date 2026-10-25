import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, {createUser, resetDatabase}, {createSupplier}] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/modules/suppliers/service')
  ]);
  await resetDatabase();
  const user = await createUser({
    name: 'Administrateur Stock',
    phoneE164: '+22221234567',
    pinHash: await hash('1234'),
    role: 'ADMIN'
  });
  await createSupplier({id: user.id, role: 'ADMIN', isActive: true, permissions: []}, {name: 'مورد الاختبار'});
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
  const supplier = receipt.getByRole('combobox', {name: 'المورد'});
  await supplier.click();
  await receipt.getByRole('option', {name: 'مورد الاختبار'}).click();
  await receipt.locator('[name="quantity"]').fill('20');
  await receipt.locator('[name="totalCost"]').fill('245');
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
  await row.getByRole('link').click();
  await page.getByRole('button', {name: 'أرشفة'}).click();
  await page.locator('.action-dialog[open]').getByRole('button', {name: 'أرشفة'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'تأكيد', exact: true}).click();
  await expect(page.locator('.detail-actions > button').filter({hasText: 'استعادة'})).toBeVisible();
  await page.goto('/ar/medicines');
  await expect(page.locator('.medicine-row').filter({hasText: 'Paracétamol UI'})).toHaveCount(0);
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

test('receives several medicines on one invoice and shows profit before confirming', async ({page}) => {
  await login(page);
  await page.goto('/ar/medicines');
  await page.locator('.form-collapse > summary').click();
  for (const [name, price] of [['Premier UI', '10.00'], ['Second UI', '40.00']]) {
    const medicineForm = page.getByTestId('medicine-form');
    await medicineForm.locator('[name="name"]').fill(name);
    await medicineForm.locator('[name="sellingPrice"]').fill(price);
    await medicineForm.getByRole('button', {name: 'إضافة الدواء'}).click();
    await expect(page.locator('.medicine-row-main').getByText(name)).toBeVisible();
  }
  await page.goto('/ar/shifts');
  await page.getByRole('button', {name: 'فتح المناوبة'}).click();
  await page.goto('/ar/stock');
  await page.locator('.form-collapse > summary').click();
  const receipt = page.getByTestId('receive-stock-form');
  const supplier = receipt.getByRole('combobox', {name: 'المورد'});
  await supplier.click();
  await receipt.getByRole('option', {name: 'مورد الاختبار'}).click();

  const first = receipt.locator('.rcv-line').nth(0);
  await first.getByRole('combobox', {name: 'الدواء'}).click();
  await first.getByRole('option', {name: /Premier UI/}).click();
  await first.locator('[name="quantity"]').fill('10');
  // 100 paid for 10 units: 10.00 a unit. The current price (10.00) loses money, the suggested one (12.00) wins.
  await first.locator('[name="totalCost"]').fill('100');
  await expect(first.locator('.rcv-unit')).toContainText('10.00');
  await expect(first.locator('[name="sellingPrice"]')).toHaveValue('12.00');
  await expect(first.locator('.rcv-result')).toContainText('+2.00');
  await first.locator('[name="sellingPrice"]').fill('9');
  await expect(first.locator('.rcv-result.is-loss')).toBeVisible();
  await expect(receipt.getByRole('button', {name: 'تأكيد الاستلام'})).toBeDisabled();
  await first.getByRole('button', {name: /المقترح/}).click();
  await expect(first.locator('[name="sellingPrice"]')).toHaveValue('12.00');

  await receipt.getByRole('button', {name: 'إضافة دواء آخر'}).click();
  const second = receipt.locator('.rcv-line').nth(1);
  await second.getByRole('combobox', {name: 'الدواء'}).click();
  await second.getByRole('option', {name: /Second UI/}).click();
  await second.locator('[name="quantity"]').fill('5');
  // 50 paid for 5 units: 10.00 a unit, but the current price (40.00) is higher than the suggestion, so it is kept.
  await second.locator('[name="totalCost"]').fill('50');
  await expect(second.locator('[name="sellingPrice"]')).toHaveValue('40.00');
  await expect(receipt.locator('.rcv-total')).toContainText('150.00');

  await receipt.getByRole('button', {name: 'تأكيد الاستلام'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'تأكيد', exact: true}).click();
  await expect(receipt.getByText('تم تسجيل الاستلام.')).toBeVisible();
  await expect(page.locator('.movement-rows li').filter({hasText: 'Premier UI'}).getByText('+10')).toBeVisible();
  await expect(page.locator('.movement-rows li').filter({hasText: 'Second UI'}).getByText('+5')).toBeVisible();
});
