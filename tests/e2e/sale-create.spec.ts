import {expect, test} from '@playwright/test';
import {eq} from 'drizzle-orm';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, factories] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Vente',
    phoneE164: '+22221234567',
    pinHash: await hash('1234'),
    role: 'ADMIN'
  });
  await factories.createShift({userId: admin.id});
  await factories.createMedicine({
    name: 'Paracétamol Vente',
    code: 'PV-01',
    sellingPrice: '25.50',
    currentStock: 5,
    createdBy: admin.id,
    updatedBy: admin.id
  });
});

test('creates one atomic sale from a rapid confirmation', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);

  await page.goto('/ar/sales');
  await page.getByRole('searchbox', {name: /ابحث بالاسم أو الرمز/}).fill('PV-01');
  await page
    .locator('.sale-medicine-results button')
    .filter({hasText: 'Paracétamol Vente'})
    .click();
  await page.locator('.quantity-stepper input').fill('2');
  await expect(page.locator('.sale-total strong')).toHaveText('51.00 MRU');

  await page.getByRole('button', {name: 'تأكيد البيع'}).click({clickCount: 2});
  await expect(page.getByText('تم تسجيل البيع — المجموع 51.00 MRU.')).toBeVisible();
  // The history and stock badge refresh without reloading the page.
  await expect(page.locator('.sale-history-rows')).toContainText('Paracétamol Vente × 2');
  await expect(
    page.locator('.sale-medicine-results button').filter({hasText: 'Paracétamol Vente'}).locator('.stock-badge')
  ).toHaveText('3 متوفر');

  const [{db}, schema] = await Promise.all([
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  const storedSales = await db.select().from(schema.sales);
  const storedItems = await db.select().from(schema.saleItems);
  const medicine = await db
    .select({currentStock: schema.medicines.currentStock})
    .from(schema.medicines)
    .where(eq(schema.medicines.code, 'PV-01'));
  const movements = await db
    .select()
    .from(schema.stockMovements)
    .where(eq(schema.stockMovements.type, 'SALE'));

  expect(storedSales).toHaveLength(1);
  expect(storedItems).toHaveLength(1);
  expect(medicine[0]?.currentStock).toBe(3);
  expect(movements).toHaveLength(1);
  expect(movements[0]?.quantityChange).toBe(-2);
});
