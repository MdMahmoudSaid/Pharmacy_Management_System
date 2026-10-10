import {expect, test} from '@playwright/test';

let seededSaleId: number;

test.beforeEach(async () => {
  process.loadEnvFile('.env.test');
  const [argon, factories, saleService] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/modules/sales/service')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Reçu',
    phoneE164: '+22221234567',
    pinHash: await argon.hash('1234'),
    role: 'ADMIN'
  });
  const shift = await factories.createShift({userId: admin.id});
  const medicine = await factories.createMedicine({
    name: 'Doliprane Reçu',
    sellingPrice: '12.75',
    currentStock: 10,
    createdBy: admin.id,
    updatedBy: admin.id
  });
  seededSaleId = (
    await saleService.createSale(
      {id: admin.id, role: 'ADMIN', isActive: true, permissions: []},
      {
        shiftId: shift.id,
        idempotencyKey: 'e2e-receipt-sale',
        items: [{medicineId: medicine.id, quantity: 2}]
      }
    )
  ).id;
});

test('print view contains the receipt and hides application navigation', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto(`/ar/sales/${seededSaleId}`);

  const receipt = page.getByTestId('receipt');
  await expect(receipt).toContainText('Doliprane Reçu');
  await expect(receipt).toContainText('2 × 12.75');
  await expect(receipt).toContainText('25.50 MRU');
  await expect(receipt).toContainText('Administrateur Reçu');

  await page.emulateMedia({media: 'print'});
  await expect(receipt).toBeVisible();
  await expect(page.locator('.desktop-sidebar')).toBeHidden();
  await expect(page.locator('.mobile-header')).toBeHidden();
  await expect(page.locator('.mobile-bottom-nav')).toBeHidden();
  await expect(page.locator('.print-button')).toBeHidden();
});
