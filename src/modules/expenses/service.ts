import {and, desc, eq, gte, lte} from 'drizzle-orm';

import {db} from '@/db/client';
import {expenses, users} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {requireActiveShift} from '@/modules/shifts/service';
import {
  authorizeExpenseCancellation,
  authorizeExpenseCorrection,
  authorizeExpenseCreation,
  authorizeExpenseView
} from './permissions';
import {
  expenseCorrectionSchema,
  expenseIdSchema,
  expenseInputSchema,
  expenseReasonSchema
} from './schemas';

export async function createExpense(
  actor: PermissionActor,
  rawInput: {shiftId: number; amount: string; description: string}
) {
  authorizeExpenseCreation(actor);
  const input = expenseInputSchema.parse(rawInput);
  return db.transaction(async (tx) => {
    const shift = await requireActiveShift(actor.id, tx);
    if (shift.id !== input.shiftId) throw new AppError('SHIFT_REQUIRED');
    const [expense] = await tx
      .insert(expenses)
      .values({
        ...input,
        operatorId: actor.id,
        createdBy: actor.id,
        updatedBy: actor.id
      })
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'expenses',
      entityId: expense.id,
      action: 'CREATE',
      newValues: {amount: expense.amount, description: expense.description},
      relatedShiftId: shift.id,
      relatedTransactionType: 'EXPENSE',
      relatedTransactionId: expense.id
    });
    return expense;
  });
}

export async function correctExpense(
  actor: PermissionActor,
  rawId: number,
  rawInput: {amount: string; description: string; reason: string}
) {
  const id = expenseIdSchema.parse(rawId);
  const input = expenseCorrectionSchema.parse(rawInput);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .for('update');
    if (!current) throw new AppError('NOT_FOUND');
    authorizeExpenseCorrection(actor, current.operatorId);
    if (current.status !== 'ACTIVE') throw new AppError('CONFLICT');
    const [expense] = await tx
      .update(expenses)
      .set({
        amount: input.amount,
        description: input.description,
        updatedBy: actor.id,
        updatedAt: new Date()
      })
      .where(eq(expenses.id, id))
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'expenses',
      entityId: id,
      action: 'CORRECT',
      oldValues: {amount: current.amount, description: current.description},
      newValues: {amount: expense.amount, description: expense.description},
      reason: input.reason,
      relatedShiftId: current.shiftId,
      relatedTransactionType: 'EXPENSE',
      relatedTransactionId: id
    });
    return expense;
  });
}

export async function cancelExpense(
  actor: PermissionActor,
  rawId: number,
  rawReason: string
) {
  const id = expenseIdSchema.parse(rawId);
  const reason = expenseReasonSchema.parse(rawReason);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .for('update');
    if (!current) throw new AppError('NOT_FOUND');
    authorizeExpenseCancellation(actor, current.operatorId);
    if (current.status !== 'ACTIVE') throw new AppError('CONFLICT');
    const [expense] = await tx
      .update(expenses)
      .set({status: 'CANCELLED', updatedBy: actor.id, updatedAt: new Date()})
      .where(eq(expenses.id, id))
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'expenses',
      entityId: id,
      action: 'CANCEL',
      oldValues: {status: current.status, amount: current.amount},
      newValues: {status: expense.status, amount: expense.amount},
      reason,
      relatedShiftId: current.shiftId,
      relatedTransactionType: 'EXPENSE',
      relatedTransactionId: id
    });
    return expense;
  });
}

export async function listExpenses(
  actor: PermissionActor,
  filters: {from?: Date; to?: Date; operatorId?: number; shiftId?: number} = {}
) {
  authorizeExpenseView(actor, actor.id);
  const mayViewAll =
    actor.role === 'ADMIN' || actor.permissions.includes('expenses.view.all');
  const conditions = [
    !mayViewAll ? eq(expenses.operatorId, actor.id) : undefined,
    filters.operatorId ? eq(expenses.operatorId, filters.operatorId) : undefined,
    filters.shiftId ? eq(expenses.shiftId, filters.shiftId) : undefined,
    filters.from ? gte(expenses.occurredAt, filters.from) : undefined,
    filters.to ? lte(expenses.occurredAt, filters.to) : undefined
  ].filter((condition) => condition !== undefined);
  return db
    .select({expense: expenses, operatorName: users.name})
    .from(expenses)
    .innerJoin(users, eq(expenses.operatorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.occurredAt));
}
