import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, factories, suppliers] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/modules/suppliers/service')
  ]);
  await factories.resetDatabase();
  const user = await factories.createUser({
    name: 'Administrateur Finance',
    phoneE164: '+22221234567',
    pinHash: await hash('1234'),
    role: 'ADMIN'
  });
  const actor = {id: user.id, role: 'ADMIN' as const, isActive: true, permissions: []};
  await factories.createShift({userId: user.id});
  await factories.createMedicine({name: 'Amoxicilline Test', currentStock: 8, averageCost: '12.50', sellingPrice: '20.00'});
  await suppliers.createSupplier(actor, {name: 'Mauripharm Test', phone: '22112233'});
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
}

test('connects medicine, supplier, stock receipt, adjustment, and accounts workspaces', async ({page}) => {
  await login(page);
  await expect(page.getByRole('heading', {name: 'نظرة مالية سريعة'})).toBeVisible();
  await expect(page.getByText('الصندوق المتاح')).toBeVisible();
  await page.goto('/ar/medicines');
  await page.getByRole('link', {name: /Amoxicilline Test/}).click();
  await expect(page).toHaveURL(/\/ar\/medicines\/\d+$/);
  await expect(page.getByText('12.50 MRU')).toBeVisible();
  await page.getByRole('button', {name: 'مطابقة المخزون الفعلي'}).click();
  const adjustmentDialog = page.locator('.action-dialog[open]');
  await adjustmentDialog.getByRole('spinbutton', {name: 'الكمية', exact: true}).fill('2');
  await adjustmentDialog.getByLabel('سبب التعديل').fill('مطابقة الجرد الفعلي');
  await adjustmentDialog.getByRole('button', {name: 'تسجيل التعديل'}).click();
  await expect(page.getByText('10 وحدة')).toBeVisible();

  await page.goto('/ar/stock');
  await expect(page.getByText('قيمة المخزون بالتكلفة')).toBeVisible();
  await expect(page.getByText('قيمة المخزون بسعر البيع')).toBeVisible();
  await expect(page.getByText('تنبيهات إعادة الطلب')).toBeVisible();
  await page.locator('.form-collapse > summary').click();
  const receipt = page.getByTestId('receive-stock-form');
  await expect(receipt.getByRole('combobox', {name: 'المورد'})).toBeVisible();
  await expect(receipt.getByLabel('تكلفة الوحدة')).toBeVisible();
  const medicinePicker = receipt.getByRole('combobox', {name: 'الدواء'});
  await medicinePicker.click();
  await receipt.getByRole('option', {name: /Amoxicilline Test/}).click();
  const supplierPicker = receipt.getByRole('combobox', {name: 'المورد'});
  await supplierPicker.click();
  await receipt.getByRole('option', {name: 'Mauripharm Test'}).click();
  await receipt.locator('[name="quantity"]').fill('4');
  await receipt.locator('[name="unitCost"]').fill('15');
  await receipt.getByRole('button', {name: 'تأكيد الاستلام'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'تأكيد', exact: true}).click();
  await expect(receipt.getByText('تم تسجيل الاستلام.')).toBeVisible();

  await page.goto('/ar/medicines');
  await page.getByRole('link', {name: /Amoxicilline Test/}).click();
  await expect(page.getByText(/Mauripharm Test.*15.00 MRU.*60.00 MRU/)).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) > 1000) {
    await page.setViewportSize({width: 2048, height: 1080});
  }
  await page.goto('/ar/suppliers');
  await page.getByRole('link', {name: /Mauripharm Test/}).click();
  await expect(page).toHaveURL(/\/ar\/suppliers\/\d+$/);
  const supplierHeroBox = await page.locator('.supplier-hero').boundingBox();
  const supplierStatsBox = await page.locator('.supplier-detail-stats').boundingBox();
  expect(supplierHeroBox).not.toBeNull();
  expect(supplierStatsBox).not.toBeNull();
  expect(Math.abs(supplierStatsBox!.x - supplierHeroBox!.x)).toBeLessThan(2);
  expect(Math.abs(supplierStatsBox!.width - supplierHeroBox!.width)).toBeLessThan(2);

  await page.goto('/ar/accounts');
  await expect(page.getByRole('link', {name: 'هذا الشهر'})).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', {name: 'إضافة أو سحب رأس مال'}).click();
  const capitalDialog = page.locator('.action-dialog[open]');
  await capitalDialog.getByLabel('المبلغ').fill('500');
  await capitalDialog.getByRole('button', {name: 'تسجيل حركة رأس المال'}).click();
  await expect(page.getByTestId('capital-balance')).toContainText('500.00');

  await page.goto('/ar/suppliers');
  await page.getByRole('link', {name: /Mauripharm Test/}).click();
  await page.getByRole('button', {name: 'تسجيل دفعة للمورد'}).click();
  const paymentDialog = page.locator('.action-dialog[open]');
  await paymentDialog.getByLabel('المبلغ المدفوع').fill('25');
  await paymentDialog.getByRole('button', {name: 'تسجيل الدفعة'}).click();
  await expect(page.locator('.entity-hero > strong')).toContainText('35.00 MRU');

  await page.goto('/ar/accounts');
  await expect(page.getByRole('heading', {name: 'الحسابات'})).toBeVisible();
  await expect(page.getByTestId('capital-balance')).toContainText('500.00');
  await expect(page.getByTestId('net-profit')).toBeVisible();
  await expect(page.locator('.accounts-metrics').getByText('35.00 MRU')).toBeVisible();
});

test('centres the capital dialog and keeps withdrawal choices and errors readable', async ({page}) => {
  await login(page);
  await page.goto('/ar/accounts');
  await page.getByRole('button', {name: 'إضافة أو سحب رأس مال'}).click();

  const dialog = page.locator('.action-dialog[open]');
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs(box!.x + box!.width / 2 - viewport!.width / 2)).toBeLessThan(3);
  expect(Math.abs(box!.y + box!.height / 2 - viewport!.height / 2)).toBeLessThan(3);

  await dialog.getByLabel('نوع الحركة').selectOption('WITHDRAWAL');
  const profitChoice = dialog.getByRole('radio', {name: /الربح/});
  const capitalChoice = dialog.getByRole('radio', {name: /رأس المال/});
  await expect(profitChoice).toBeVisible();
  await expect(capitalChoice).toBeVisible();
  await expect(profitChoice).toBeChecked();
  const radioBox = await profitChoice.boundingBox();
  expect(radioBox!.width).toBeLessThanOrEqual(20);
  expect(radioBox!.height).toBeLessThanOrEqual(20);

  await dialog.getByLabel('المبلغ').fill('1');
  await dialog.getByRole('button', {name: 'تسجيل حركة رأس المال'}).click();
  const error = dialog.locator('.form-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveCSS('color', 'rgb(143, 29, 20)');
  await expect(error).toHaveCSS('background-color', 'rgb(255, 240, 238)');
});
