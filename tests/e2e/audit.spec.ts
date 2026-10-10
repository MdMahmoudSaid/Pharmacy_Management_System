import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [argon, factories, permissionService, client, schema] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database'),
    import('../../src/modules/permissions/service'),
    import('../../src/db/client'),
    import('../../src/db/schema')
  ]);
  await factories.resetDatabase();
  const admin = await factories.createUser({role: 'ADMIN'});
  const employee = await factories.createUser({
    name: 'Lecteur Audit',
    phoneE164: '+22231234567',
    pinHash: await argon.hash('5678')
  });
  await permissionService.syncPermissionCatalog();
  await client.db.insert(schema.userPermissions).values({
    userId: employee.id,
    permissionKey: 'audit.view.all',
    grantedBy: admin.id
  });
  const shift = await factories.createShift({userId: employee.id});
  await client.db.insert(schema.auditLogs).values({
    actorId: employee.id,
    entityType: 'shifts',
    entityId: shift.id,
    action: 'CREATE',
    newValues: {status: 'OPEN'}
  });
});

test('employee can inspect audit but has no mutation controls', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('31234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('5678');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/ar/audit');
  await expect(page.getByText(/إنشاء · مناوبة/)).toBeVisible();
  await expect(page.locator('.audit-changes')).toContainText('مفتوحة');
  await expect(page.getByRole('button', {name: /تعديل|حذف/})).toHaveCount(0);
  await expect(page.locator('.audit-table form')).toHaveCount(0);
});
