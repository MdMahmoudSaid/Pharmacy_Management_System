import {expect, test} from '@playwright/test';
import {inArray} from 'drizzle-orm';

test.beforeEach(async () => {
  process.loadEnvFile('.env.test');
  const [argon, factories, client, schema, permissionsService] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/db/client'),
    import('../../src/db/schema'),
    import('../../src/modules/permissions/service')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({
    name: 'Administrateur Test',
    phoneE164: '+22221234567',
    pinHash: await argon.hash('1234'),
    role: 'ADMIN'
  });
  const employee = await factories.createUser({
    name: 'Employé Shift',
    phoneE164: '+22231234567',
    pinHash: await argon.hash('5678')
  });
  await permissionsService.syncPermissionCatalog();
  await client.db.insert(schema.userPermissions).values(
    ['shifts.open.own', 'shifts.close.own', 'shifts.view.own'].map(
      (permissionKey) => ({
        userId: employee.id,
        permissionKey,
        grantedBy: admin.id
      })
    )
  );
});

async function login(page: import('@playwright/test').Page, phone: string, pin: string) {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill(phone);
  await page
    .getByRole('textbox', {name: 'الرمز السري', exact: true})
    .fill(pin);
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
}

async function logout(page: import('@playwright/test').Page) {
  await page.goto('/ar/dashboard');
  await page.getByRole('button', {name: 'تسجيل الخروج'}).click();
}

test('employee operates one shift and admin audits correction and reopen', async ({
  page
}) => {
  await login(page, '31234567', '5678');
  await page.goto('/ar/shifts');
  await page.getByRole('button', {name: 'فتح المناوبة'}).click();
  await expect(page.getByText('المناوبة الحالية مفتوحة منذ')).toBeVisible();

  await logout(page);
  await login(page, '21234567', '1234');
  await page.goto('/ar/shifts');
  await expect(page.getByText('Employé Shift')).toBeVisible();

  await logout(page);
  await login(page, '31234567', '5678');
  await page.goto('/ar/shifts');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', {name: 'إغلاق المناوبة'}).click();
  await expect(page.getByText('مغلقة')).toBeVisible();

  await logout(page);
  await login(page, '21234567', '1234');
  await page.goto('/ar/shifts');
  const row = page.locator('.shift-row').filter({hasText: 'Employé Shift'});
  await row.locator('.reopen-form [name="reason"]').fill('Fermeture erronée');
  await row.getByRole('button', {name: 'إعادة فتح'}).click();
  await expect(row.getByText('مفتوحة')).toBeVisible();
  await row.getByText('تصحيح التوقيت').click();
  await row.locator('details [name="reason"]').fill('Correction validée');
  await row.getByRole('button', {name: 'حفظ التصحيح'}).click();
  await expect(row.getByTestId('correction-saved')).toBeVisible();

  const [{db}, {auditLogs}] = await Promise.all([
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  const audits = await db
    .select({action: auditLogs.action, reason: auditLogs.reason})
    .from(auditLogs)
    .where(inArray(auditLogs.action, ['REOPEN', 'CORRECT']));
  expect(audits).toEqual(
    expect.arrayContaining([
      {action: 'REOPEN', reason: 'Fermeture erronée'},
      {action: 'CORRECT', reason: 'Correction validée'}
    ])
  );
});
