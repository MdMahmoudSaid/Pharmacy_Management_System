import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, {createUser, resetDatabase}] = await Promise.all([
    import('@node-rs/argon2'),
    import('../factories/database')
  ]);
  await resetDatabase();
  await createUser({name: 'Administrateur Test', phoneE164: '+22221234567', pinHash: await hash('1234'), role: 'ADMIN'});
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/fr/dashboard');
}

test('mobile "more" page lists the remaining pages and logs out', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await login(page);

  await page.getByRole('navigation', {name: 'Navigation mobile'}).getByRole('link', {name: 'Plus'}).click();
  await expect(page).toHaveURL(/\/fr\/more$/);
  const links = page.getByRole('navigation', {name: 'Plus'});
  for (const name of ['Dépenses', 'Employés', 'Médicaments', 'Rapports', 'Audit', 'Paramètres']) {
    await expect(links.getByRole('link', {name})).toBeVisible();
  }
  await expect(links.getByRole('link', {name: 'Ventes'})).toHaveCount(0);
  await page.screenshot({path: process.env.SHOT ?? 'test-results/more.png', fullPage: true});

  await page.getByRole('button', {name: 'Déconnexion'}).click();
  await expect(page).toHaveURL(/\/fr\/login$/);
});

test('desktop sidebar no longer shows "more"', async ({page}) => {
  await login(page);
  await expect(page.getByRole('navigation', {name: 'Navigation principale'}).getByRole('link', {name: 'Plus'})).toHaveCount(0);
});
