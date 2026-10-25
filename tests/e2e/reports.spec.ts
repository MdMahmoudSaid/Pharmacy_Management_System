import {expect, test, type Page} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [argon, factories, salesService, expensesService, stockService, suppliersService, client, schema, permissionsService] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/modules/sales/service'),
    import('../../src/modules/expenses/service'),
    import('../../src/modules/stock/service'),
    import('../../src/modules/suppliers/service'),
    import('../../src/db/client'),
    import('../../src/db/schema'),
    import('../../src/modules/permissions/service')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Rapports',
    phoneE164: '+22221234567',
    pinHash: await argon.hash('1234'),
    role: 'ADMIN'
  });
  const employee = await factories.createUser({
    name: 'Employé Rapports',
    phoneE164: '+22231234567',
    pinHash: await argon.hash('5678')
  });
  await permissionsService.syncPermissionCatalog();
  await client.db.insert(schema.userPermissions).values(
    ['reports.view.own', 'reports.print.own'].map((permissionKey) => ({userId: employee.id, permissionKey, grantedBy: admin.id}))
  );
  const actor = {id: admin.id, role: 'ADMIN' as const, isActive: true, permissions: []};
  const supplier = await suppliersService.createSupplier(actor, {name: 'Fournisseur Rapports'});
  const shift = await factories.createShift({userId: admin.id});
  const medicine = await factories.createMedicine({name: 'Stock Rapport', currentStock: 10, sellingPrice: '10.00', minStock: 3});
  await factories.createMedicine({name: 'Sirop Rupture', currentStock: 0, sellingPrice: '7.50', minStock: 2});
  const lowMedicine = await factories.createMedicine({name: 'Gélule Faible', currentStock: 3, sellingPrice: '4.00', minStock: 5});
  await salesService.createSale(actor, {shiftId: shift.id, idempotencyKey: 'report-low', items: [{medicineId: lowMedicine.id, quantity: 1}]});
  await salesService.createSale(actor, {shiftId: shift.id, idempotencyKey: 'report-e2e', items: [{medicineId: medicine.id, quantity: 2}]});
  const cancelled = await salesService.createSale(actor, {shiftId: shift.id, idempotencyKey: 'report-cancel', items: [{medicineId: medicine.id, quantity: 1}]});
  await salesService.cancelSale(actor, cancelled.id, 'Erreur de saisie');
  await expensesService.createExpense(actor, {shiftId: shift.id, amount: '5.00', description: 'Frais rapport'});
  await stockService.receiveStock(actor, {medicineId: medicine.id, supplierId: supplier.id, quantity: 4, unitCost: '6.00', sellingPrice: '12.00'});
});

async function login(page: Page, phone: string, pin: string) {
  await page.goto('/fr/login');
  await page.getByLabel('Numéro de téléphone').fill(phone);
  await page.getByRole('textbox', {name: 'Code PIN', exact: true}).fill(pin);
  await page.getByRole('button', {name: 'Connexion', exact: true}).click();
  await expect(page).toHaveURL(/\/fr\/dashboard$/);
}

test('lists every report and reconciles the financial summary', async ({page}) => {
  await login(page, '21234567', '1234');
  await page.goto('/fr/reports');
  await expect(page.locator('.report-card')).toHaveCount(14);
  await expect(page.getByRole('link', {name: /Mouvements de caisse/})).toBeVisible();
  await expect(page.getByRole('link', {name: /Soldes fournisseurs/})).toBeVisible();
  await page.getByRole('link', {name: /Synthèse financière/}).click();
  await expect(page).toHaveURL(/\/fr\/reports\/financial-summary$/);
  const summary = page.locator('.rpt-summary');
  await expect(summary.first().locator('.rpt-summary-primary')).toContainText('19.00 MRU');
  await expect(summary.first()).toContainText('24.00 MRU');
  await expect(summary.first()).toContainText('5.00 MRU');
  const footer = page.locator('.no-print .rpt-table tfoot');
  await expect(footer).toContainText('24.00 MRU');
  await expect(footer).toContainText('19.00 MRU');
});

test('sales journal filters, prints and downloads a PDF directly', async ({page}) => {
  await login(page, '21234567', '1234');
  await page.goto('/fr/reports/sales-journal');
  const table = page.locator('.no-print .rpt-table');
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(table.locator('tbody tr.is-cancelled')).toContainText('Annulée');
  await expect(table.locator('tfoot')).toContainText('24.00 MRU');

  await page.getByLabel('Statut').selectOption('CANCELLED');
  await page.getByRole('button', {name: 'Appliquer'}).click();
  await expect(page).toHaveURL(/status=CANCELLED/);
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('link', {name: /CSV/})).toHaveCount(0);

  const sheet = page.locator('#report-sheet');
  await expect(sheet.locator('.rpt-head')).toContainText('Pharmacy');
  await expect(sheet.locator('.rpt-print-heading')).toContainText('Statut : Annulée');
  await expect(sheet).not.toBeInViewport();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', {name: 'Télécharger le PDF'}).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^Journal des ventes .*\.pdf$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe('%PDF-');
  if (process.env.SHOTS_DIR) await download.saveAs(`${process.env.SHOTS_DIR}/report.pdf`);
  await expect(page).toHaveURL(/\/fr\/reports\/sales-journal/);

  await page.emulateMedia({media: 'print'});
  await expect(page.locator('.report-heading')).toBeHidden();
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.rpt-table')).toBeVisible();
});

test('stock alerts and shift totals use the right medicine and shift', async ({page}) => {
  await login(page, '21234567', '1234');
  await page.goto('/fr/reports/stock-alerts');
  const rows = page.locator('.no-print .rpt-table tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({hasText: 'Gélule Faible'})).toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(rows.filter({hasText: 'Sirop Rupture'})).toContainText('Rupture');
  await page.goto('/fr/reports/shifts');
  const shiftFooter = page.locator('.no-print .rpt-table tfoot');
  await expect(shiftFooter).toContainText('24.00 MRU');
  await expect(shiftFooter).toContainText('19.00 MRU');
  await page.goto('/fr/reports/dormant-stock');
  await expect(page.locator('.no-print .rpt-table tbody tr')).toHaveCount(0);
});

test('an employee only reaches the reports about their own activity', async ({page}) => {
  await login(page, '31234567', '5678');
  await page.goto('/fr/reports');
  await expect(page.locator('.report-card')).toHaveCount(5);
  await expect(page.getByRole('link', {name: /Valeur du stock/})).toHaveCount(0);
  const response = await page.goto('/fr/reports/stock-valuation');
  expect(response?.status()).toBe(404);
  await page.goto('/fr/reports/sales-journal');
  await expect(page.locator('.no-print .rpt-table')).toHaveCount(0);
  await expect(page.locator('.no-print').getByText('Aucune donnée pour ces filtres.')).toBeVisible();
});

test('report pages fit a phone screen in both languages', async ({page}) => {
  test.setTimeout(90000);
  await login(page, '21234567', '1234');
  for (const [width, height] of [[390, 844], [1280, 900]] as const) {
    await page.setViewportSize({width, height});
    for (const locale of ['ar', 'fr']) {
      for (const path of ['reports', 'reports/sales-journal', 'reports/stock-alerts', 'reports/shifts']) {
        await page.goto(`/${locale}/${path}`);
        if (width < 600) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth), `${locale}/${path}`).toBeLessThanOrEqual(width);
        }
        if (process.env.SHOTS_DIR) {
          await page.screenshot({path: `${process.env.SHOTS_DIR}/rpt-${width}-${locale}-${path.replaceAll('/', '-')}.png`, fullPage: true});
        }
      }
    }
  }
});
