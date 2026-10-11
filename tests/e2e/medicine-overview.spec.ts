import {expect, test} from '@playwright/test';

test.beforeEach(async () => {
  if (!process.env.DATABASE_URL) process.loadEnvFile('.env.test');
  const [{hash}, f] = await Promise.all([import('@node-rs/argon2'), import('../factories/database')]);
  await f.resetDatabase();
  await f.createUser({name: 'Administrateur Catalogue', phoneE164: '+22221234567', pinHash: await hash('1234'), role: 'ADMIN'});
  await f.createMedicine({name: 'Disponible A', currentStock: 40, minStock: 5, sellingPrice: '100.00'});
  await f.createMedicine({name: 'Bas B', currentStock: 3, minStock: 5, sellingPrice: '50.00'});
  await f.createMedicine({name: 'Rupture C', currentStock: 0, minStock: 5, sellingPrice: '10.00'});
  await f.createMedicine({name: 'Archive D', currentStock: 9, isActive: false});
});

test('dashboard medicines card summarises the catalogue and links to filtered lists', async ({page}) => {
  await page.goto('/ar/login');
  await page.getByLabel('رقم الهاتف').fill('21234567');
  await page.getByRole('textbox', {name: 'الرمز السري', exact: true}).fill('1234');
  await page.getByRole('button', {name: 'دخول', exact: true}).click();
  await expect(page).toHaveURL(/\/ar\/dashboard$/);
  await page.goto('/fr/dashboard');

  const card = page.locator('.metric-catalog');
  await expect(card.locator('strong')).toHaveText('3');
  await expect(card.getByRole('link', {name: '1 en rupture'})).toBeVisible();
  await expect(card.getByRole('link', {name: '1 stock bas'})).toBeVisible();

  await card.getByRole('link', {name: '1 en rupture'}).click();
  await expect(page).toHaveURL(/\/fr\/medicines\?filter=out$/);
  await expect(page.getByRole('button', {name: /En rupture/})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.medicine-row')).toHaveCount(1);
  await expect(page.locator('.medicine-row')).toContainText('Rupture C');

  // Active stock only: 40 × 100 + 3 × 50 = 4,150.00 MRU over 43 units.
  await expect(page.locator('.catalog-value')).toContainText('4,150.00');
  await expect(page.locator('.catalog-value')).toContainText('43 unités');

  await page.getByRole('button', {name: /Disponibles/}).click();
  await expect(page.locator('.medicine-row')).toHaveCount(1);
  await expect(page.locator('.medicine-row')).toContainText('Disponible A');

  await page.goto('/fr/dashboard');
  await card.getByRole('link', {name: 'Médicaments'}).click();
  await expect(page).toHaveURL(/\/fr\/medicines$/);
  await expect(page.locator('.medicine-row')).toHaveCount(3);
});
