import {expect, test, type Page} from '@playwright/test';

let shiftId = 0;

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [argon, factories, client, schema, permissionsService] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/db/client'),
    import('../../src/db/schema'),
    import('../../src/modules/permissions/service')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Shift',
    phoneE164: '+22221234567',
    pinHash: await argon.hash('1234'),
    role: 'ADMIN'
  });
  const employee = await factories.createUser({
    name: 'Aïcha Vendeuse',
    phoneE164: '+22231234567',
    pinHash: await argon.hash('5678')
  });
  const other = await factories.createUser({
    name: 'Autre Employé',
    phoneE164: '+22241234567',
    pinHash: await argon.hash('4321')
  });
  await permissionsService.syncPermissionCatalog();
  await client.db.insert(schema.userPermissions).values(
    ['shifts.view.own', 'sales.view.own'].flatMap((permissionKey) =>
      [employee.id, other.id].map((userId) => ({userId, permissionKey, grantedBy: admin.id}))
    )
  );
  const shift = await factories.createShift({
    userId: employee.id,
    openedAt: new Date('2026-10-10T08:00:00Z'),
    closedAt: new Date('2026-10-10T12:30:00Z'),
    status: 'CLOSED'
  });
  shiftId = shift.id;
  const medicine = await factories.createMedicine({
    name: 'Amoxicilline Shift',
    code: 'AS-01',
    sellingPrice: '40.00',
    currentStock: 20,
    createdBy: admin.id,
    updatedBy: admin.id
  });
  const [sale, cancelledSale] = await client.db
    .insert(schema.sales)
    .values([
      {saleNumber: 'S-SHIFT-1', shiftId, operatorId: employee.id, total: '80.00', idempotencyKey: 'k1', createdAt: new Date('2026-10-10T09:00:00Z')},
      {saleNumber: 'S-SHIFT-2', shiftId, operatorId: employee.id, total: '40.00', status: 'CANCELLED', idempotencyKey: 'k2', createdAt: new Date('2026-10-10T10:00:00Z')}
    ])
    .returning();
  await client.db.insert(schema.saleItems).values([
    {saleId: sale.id, medicineId: medicine.id, quantity: 2, unitPrice: '40.00', lineTotal: '80.00'},
    {saleId: cancelledSale.id, medicineId: medicine.id, quantity: 1, unitPrice: '40.00', lineTotal: '40.00'}
  ]);
  await client.db.insert(schema.expenses).values({
    amount: '15.00',
    description: 'Taxi livraison',
    shiftId,
    operatorId: employee.id
  });
  await client.db.insert(schema.stockReceipts).values({
    medicineId: medicine.id,
    quantity: 12,
    shiftId,
    operatorId: employee.id,
    createdBy: employee.id
  });
});

async function login(page: Page, phone: string, pin: string) {
  await page.goto('/fr/login');
  await page.getByLabel('Numéro de téléphone').fill(phone);
  await page.getByRole('textbox', {name: 'Code PIN', exact: true}).fill(pin);
  await page.getByRole('button', {name: 'Connexion', exact: true}).click();
  await expect(page).toHaveURL(/\/fr\/dashboard$/);
}

test('admin opens a closed shift and sees everything done during it', async ({page}) => {
  await login(page, '21234567', '1234');
  await page.goto('/fr/shifts');
  await page.locator('.shift-row-link').filter({hasText: 'Aïcha Vendeuse'}).click();
  await expect(page).toHaveURL(new RegExp(`/fr/shifts/${shiftId}$`));

  await expect(page.getByRole('heading', {level: 1})).toHaveText('Aïcha Vendeuse');
  await expect(page.locator('.shift-duration')).toHaveText('4 h 30 min');
  const metrics = page.locator('.shift-metrics');
  await expect(metrics).toContainText('80.00 MRU');
  await expect(metrics).toContainText('15.00 MRU');
  await expect(metrics).toContainText('65.00 MRU');
  await expect(metrics).toContainText('12 unités');

  const sales = page.getByTestId('shift-sales');
  await expect(sales.locator('li')).toHaveCount(2);
  await expect(sales).toContainText('Amoxicilline Shift × 2');
  await expect(sales.locator('li.is-cancelled')).toContainText('Annulée');
  await expect(page.getByTestId('shift-expenses')).toContainText('Taxi livraison');
  await expect(page.getByTestId('shift-receipts')).toContainText('Amoxicilline Shift');

  await sales.getByRole('link', {name: 'Amoxicilline Shift × 2'}).click();
  await expect(page).toHaveURL(/\/fr\/sales\/\d+$/);
});

test('an employee sees only their own shift detail', async ({page}) => {
  await login(page, '41234567', '4321');
  const response = await page.goto(`/fr/shifts/${shiftId}`);
  expect(response?.status()).toBe(404);
});

test('shift detail fits a phone screen in both languages', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await login(page, '21234567', '1234');
  for (const locale of ['ar', 'fr']) {
    for (const path of ['shifts', `shifts/${shiftId}`]) {
      await page.goto(`/${locale}/${path}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
      if (process.env.SHOTS_DIR) {
        await page.screenshot({path: `${process.env.SHOTS_DIR}/${locale}-${path.replace('/', '-')}.png`, fullPage: true});
      }
    }
  }
});
