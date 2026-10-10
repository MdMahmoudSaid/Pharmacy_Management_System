import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [argon, factories, salesService, expensesService] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/modules/sales/service'),
    import('../../src/modules/expenses/service')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Rapports',
    phoneE164: '+22221234567',
    pinHash: await argon.hash('1234'),
    role: 'ADMIN'
  });
  const actor = {id: admin.id, role: 'ADMIN' as const, isActive: true, permissions: []};
  const shift = await factories.createShift({userId: admin.id});
  const medicine = await factories.createMedicine({name: 'Stock Rapport', currentStock: 10, sellingPrice: '10.00'});
  await salesService.createSale(actor, {shiftId: shift.id, idempotencyKey: 'report-e2e', items: [{medicineId: medicine.id, quantity: 2}]});
  await expensesService.createExpense(actor, {shiftId: shift.id, amount: '5.00', description: 'Frais rapport'});
});

test('reconciles report totals and prints without application chrome', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/ar/reports');
  const summary = page.locator('.report-summary');
  await expect(summary.getByText('20.00 MRU', {exact: true})).toBeVisible();
  await expect(summary.getByText('5.00 MRU', {exact: true})).toBeVisible();
  await expect(summary.getByText('15.00 MRU', {exact: true})).toBeVisible();
  await expect(page.getByRole('cell', {name: 'Stock Rapport × 2'})).toBeVisible();
  await page.getByRole('tab', {name: 'المخزون', exact: true}).click();
  await expect(page.getByRole('cell', {name: 'Stock Rapport'})).toBeVisible();
  await page.emulateMedia({media: 'print'});
  await expect(page.locator('.desktop-sidebar')).toBeHidden();
  await expect(page.locator('.report-filters')).toBeHidden();
  await expect(page.locator('.report-table')).toBeVisible();
});
