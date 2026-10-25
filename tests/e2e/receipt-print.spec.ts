import {expect, test} from '@playwright/test';

let seededSaleId: number;

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
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
  const line = receipt.locator('.receipt-lines tbody tr');
  await expect(line).toContainText('Doliprane Reçu');
  await expect(line.locator('td').nth(1)).toHaveText('2');
  await expect(line.locator('td').nth(2)).toHaveText('12.75');
  await expect(line.locator('td').nth(3)).toHaveText('25.50');
  await expect(receipt.locator('.receipt-total strong')).toHaveText('25.50 MRU');
  await expect(receipt.locator('.receipt-head')).toContainText('صيدلية حرما آمنا');
  await expect(receipt).toContainText('Administrateur Reçu');

  const quantityHeader = await receipt.locator('.receipt-lines thead th').nth(1).boundingBox();
  const quantityCell = await line.locator('td').nth(1).boundingBox();
  if (quantityHeader && quantityCell) {
    // Wide layouts keep numbers on the same edge as their column header.
    expect(Math.abs(quantityHeader.x - quantityCell.x)).toBeLessThan(2);
  } else {
    // Phones intentionally fold quantity and unit price below the medicine name.
    await expect(line.locator('.receipt-line-detail')).toContainText('2');
  }

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', {name: 'حفظ بصيغة PDF'}).click()
  ]);
  expect(download.suggestedFilename()).toBe(`ايصال-بيع-${seededSaleId}.pdf`);
  if (process.env.SHOTS_DIR) await download.saveAs(`${process.env.SHOTS_DIR}/receipt.pdf`);

  await page.emulateMedia({media: 'print'});
  await expect(receipt).toBeVisible();
  await expect(page.locator('.desktop-sidebar')).toBeHidden();
  await expect(page.locator('.mobile-header')).toBeHidden();
  await expect(page.locator('.mobile-bottom-nav')).toBeHidden();
  await expect(page.locator('.print-button')).toBeHidden();
});
