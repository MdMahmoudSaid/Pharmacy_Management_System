import {and, eq, sql} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {auditLogs, expenses, shifts} from '@/db/schema';
import {
  cancelExpense,
  correctExpense,
  createExpense,
  listExpenses
} from '@/modules/expenses/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {createShift, createUser, resetDatabase} from '../../factories/database';

describe('expense lifecycle', () => {
  let employee: PermissionActor;
  let shiftId: number;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    employee = {
      id: user.id,
      role: 'EMPLOYEE',
      isActive: true,
      permissions: [
        'expenses.create.own',
        'expenses.view.own',
        'expenses.correct.own',
        'expenses.cancel.own'
      ]
    };
    shiftId = (await createShift({userId: user.id})).id;
  });

  it('creates, corrects, and cancels while preserving audited history', async () => {
    const created = await createExpense(employee, {
      shiftId,
      amount: '500.00',
      description: 'Transport fournisseur'
    });
    await db
      .update(shifts)
      .set({status: 'CLOSED', closedAt: new Date()})
      .where(eq(shifts.id, shiftId));
    const corrected = await correctExpense(employee, created.id, {
      amount: '300.00',
      description: 'Transport fournisseur',
      reason: 'Montant saisi incorrectement'
    });
    const activeRows = await listExpenses(employee);
    const [activeTotal] = await db
      .select({total: sql<string>`coalesce(sum(${expenses.amount}), 0)`})
      .from(expenses)
      .where(eq(expenses.status, 'ACTIVE'));
    const [correctionAudit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, created.id), eq(auditLogs.action, 'CORRECT')));

    expect(corrected.amount).toBe('300.00');
    expect(activeRows[0]).toMatchObject({
      expense: {id: created.id, shiftId, operatorId: employee.id, amount: '300.00'}
    });
    expect(activeTotal.total).toBe('300.00');
    expect(correctionAudit.oldValues).toMatchObject({amount: '500.00'});
    expect(correctionAudit.newValues).toMatchObject({amount: '300.00'});

    const cancelled = await cancelExpense(employee, created.id, 'Dépense annulée');
    const [afterCancelTotal] = await db
      .select({total: sql<string>`coalesce(sum(${expenses.amount}), 0)`})
      .from(expenses)
      .where(eq(expenses.status, 'ACTIVE'));
    expect(cancelled.status).toBe('CANCELLED');
    expect(afterCancelTotal.total).toBe('0');
    expect(await listExpenses(employee)).toHaveLength(1);
  });

  it.each([
    {amount: '0', description: 'Zéro'},
    {amount: '-1', description: 'Négatif'},
    {amount: '1.234', description: 'Trois décimales'},
    {amount: '10.00', description: '   '}
  ])('rejects invalid expense %#', async ({amount, description}) => {
    await expect(
      createExpense(employee, {shiftId, amount, description})
    ).rejects.toBeDefined();
    expect(await db.select().from(expenses)).toEqual([]);
  });

  it('requires an active shift only for creation', async () => {
    await db
      .update(shifts)
      .set({status: 'CLOSED', closedAt: new Date()})
      .where(eq(shifts.id, shiftId));
    await expect(
      createExpense(employee, {shiftId, amount: '20.00', description: 'Taxi'})
    ).rejects.toMatchObject({code: 'SHIFT_REQUIRED'});
  });

  it('corrects without a reason, requires one to cancel, and enforces own/all scope', async () => {
    const expense = await createExpense(employee, {
      shiftId,
      amount: '100.00',
      description: 'Livraison'
    });
    await expect(
      correctExpense(employee, expense.id, {
        amount: '80.00',
        description: 'Livraison',
        reason: ''
      })
    ).resolves.toMatchObject({amount: '80.00'});
    await expect(cancelExpense(employee, expense.id, '  ')).rejects.toBeDefined();

    const otherUser = await createUser();
    const outsider: PermissionActor = {
      id: otherUser.id,
      role: 'EMPLOYEE',
      isActive: true,
      permissions: ['expenses.view.own', 'expenses.correct.own', 'expenses.cancel.own']
    };
    await expect(
      correctExpense(outsider, expense.id, {
        amount: '80.00',
        description: 'Livraison',
        reason: 'Interdit'
      })
    ).rejects.toMatchObject({code: 'FORBIDDEN'});
    await expect(cancelExpense(outsider, expense.id, 'Interdit')).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(listExpenses(outsider)).resolves.toEqual([]);

    const manager: PermissionActor = {
      ...outsider,
      permissions: ['expenses.view.all', 'expenses.correct.all', 'expenses.cancel.all']
    };
    await expect(listExpenses(manager)).resolves.toHaveLength(1);
    await expect(
      correctExpense(manager, expense.id, {
        amount: '80.00',
        description: 'Livraison',
        reason: 'Autorisé'
      })
    ).resolves.toMatchObject({amount: '80.00'});
  });
});
