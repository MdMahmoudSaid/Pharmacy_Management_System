import {expect, test} from '@playwright/test';
import {eq} from 'drizzle-orm';

let seededSaleId: number;

test.beforeEach(async () => {
  process.loadEnvFile('.env.test');
  const [argon, factories, saleService, client, schema] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/modules/sales/service'),
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Correction',
    phoneE164: '+22221234567',
    pinHash: await argon.hash('1234'),
    role: 'ADMIN'
  });
  const shift = await factories.createShift({userId: admin.id});
  const medicine = await factories.createMedicine({
    name: 'Amoxicilline Correction',
    code: 'AC-01',
    sellingPrice: '25.50',
    currentStock: 20,
    createdBy: admin.id,
    updatedBy: admin.id
  });
  const sale = await saleService.createSale(
    {id: admin.id, role: 'ADMIN', isActive: true, permissions: []},
    {
      shiftId: shift.id,
      idempotencyKey: 'e2e-correction-sale',
      items: [{medicineId: medicine.id, quantity: 3}]
    }
  );
  seededSaleId = sale.id;
  await client.db
    .update(schema.shifts)
    .set({status: 'CLOSED', closedAt: new Date()})
    .where(eq(schema.shifts.id, shift.id));
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
}

test('admin corrects and cancels a sale without an open shift', async ({page}) => {
  await login(page);
  await page.goto('/ar/sales');
  await expect(page.getByText('افتح مناوبة قبل البيع')).toBeVisible();
  await page.getByRole('link', {name: /S-/}).click();
  await expect(page).toHaveURL(new RegExp(`/ar/sales/${seededSaleId}$`));

  await page.getByText('تصحيح عملية البيع', {exact: true}).click();
  const correction = page.getByTestId('correct-sale-form');
  await correction.locator('input[type="number"]').fill('2');
  await correction.locator('[name="reason"]').fill('خطأ في الكمية');
  await correction.getByRole('button', {name: 'حفظ التصحيح'}).click();
  await expect(correction.getByText('تم حفظ التصحيح.')).toBeVisible();
  await expect(page.locator('[data-testid="receipt"] footer strong')).toHaveText('51.00 MRU');

  const cancellation = page.locator('.cancel-sale-form');
  await cancellation.locator('[name="reason"]').fill('بيع مكرر');
  await cancellation.getByRole('button', {name: 'إلغاء عملية البيع'}).click();
  await expect(page.locator('.receipt-cancelled')).toHaveText('ملغاة');

  const [{db}, schema] = await Promise.all([
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  const [medicine] = await db
    .select({stock: schema.medicines.currentStock})
    .from(schema.medicines)
    .where(eq(schema.medicines.code, 'AC-01'));
  const [sale] = await db
    .select({status: schema.sales.status})
    .from(schema.sales)
    .where(eq(schema.sales.id, seededSaleId));
  expect(medicine.stock).toBe(20);
  expect(sale.status).toBe('CANCELLED');
});
