import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {auditLogs} from '@/db/schema';
import {recordCapitalMovement} from '@/modules/accounts/service';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  renameExpenseCategory
} from '@/modules/expenses/categories';
import {createExpense, listExpenses} from '@/modules/expenses/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {createShift, createUser, resetDatabase} from '../../factories/database';

describe('expense categories', () => {
  let admin: PermissionActor;
  let cashier: PermissionActor;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const adminUser = await createUser({role: 'ADMIN'});
    const cashierUser = await createUser();
    admin = {id: adminUser.id, role: 'ADMIN', isActive: true, permissions: []};
    cashier = {id: cashierUser.id, role: 'EMPLOYEE', isActive: true, permissions: ['expenses.create.own', 'expenses.view.own']};
  });

  it('lets an expense creator add a category but keeps rename and delete for settings managers', async () => {
    const category = await createExpenseCategory(cashier, '  Loyer ');
    expect(category.name).toBe('Loyer');
    await expect(renameExpenseCategory(cashier, category.id, 'Rent')).rejects.toThrow('FORBIDDEN');
    await expect(deleteExpenseCategory(cashier, category.id)).rejects.toThrow('FORBIDDEN');
    const outsider: PermissionActor = {...cashier, permissions: []};
    await expect(createExpenseCategory(outsider, 'Taxi')).rejects.toThrow('FORBIDDEN');
  });

  it('rejects duplicate names regardless of case', async () => {
    await createExpenseCategory(admin, 'Électricité');
    await expect(createExpenseCategory(admin, 'électricité')).rejects.toThrow('CONFLICT');
    const other = await createExpenseCategory(admin, 'Eau');
    await expect(renameExpenseCategory(admin, other.id, 'ÉLECTRICITÉ')).rejects.toThrow('CONFLICT');
  });

  it('archives a deleted category, keeps its name on past expenses, and audits every change', async () => {
    const shift = await createShift({userId: cashier.id});
    const category = await createExpenseCategory(admin, 'Transport');
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '100.00'});
    await createExpense(cashier, {shiftId: shift.id, amount: '40.00', categoryId: category.id});
    await renameExpenseCategory(admin, category.id, 'Transport fournisseur');
    await deleteExpenseCategory(admin, category.id);

    expect(await listExpenseCategories()).toEqual([]);
    const [row] = await listExpenses(cashier);
    expect(row.categoryName).toBe('Transport fournisseur');
    await expect(
      createExpense(cashier, {shiftId: shift.id, amount: '10.00', categoryId: category.id})
    ).rejects.toThrow('VALIDATION_ERROR');
    await expect(createExpenseCategory(admin, 'Transport fournisseur')).resolves.toMatchObject({name: 'Transport fournisseur'});

    const audits = await db.select().from(auditLogs).where(eq(auditLogs.entityType, 'expense_categories'));
    expect(audits.map(({action}) => action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'CREATE']);
  });
});
