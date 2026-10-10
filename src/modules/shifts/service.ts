import {and, eq, sql} from 'drizzle-orm';
import Decimal from 'decimal.js';

import {db, type Database, type DbTransaction} from '@/db/client';
import {shifts} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {
  correctShiftSchema,
  reopenShiftSchema,
  shiftIdSchema
} from './schemas';

type QueryExecutor = Database | DbTransaction;

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'cause' in error &&
  typeof error.cause === 'object' &&
  error.cause !== null &&
  'code' in error.cause &&
  error.cause.code === '23505';

async function getShift(shiftId: number, executor: QueryExecutor = db) {
  const [shift] = await executor
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);
  if (!shift) throw new AppError('NOT_FOUND');
  return shift;
}

export async function openShift(actor: PermissionActor, now = new Date()) {
  authorize(actor, 'shifts.open.own', actor.id);
  try {
    return await db.transaction(async (tx) => {
      const [shift] = await tx
        .insert(shifts)
        .values({
          userId: actor.id,
          openedAt: now,
          status: 'OPEN',
          createdBy: actor.id,
          updatedBy: actor.id
        })
        .returning();
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'shifts',
        entityId: shift.id,
        action: 'CREATE',
        newValues: {userId: actor.id, openedAt: now.toISOString(), status: 'OPEN'},
        relatedShiftId: shift.id
      });
      return shift;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError('SHIFT_ALREADY_OPEN');
    throw error;
  }
}

export async function closeShift(
  actor: PermissionActor,
  shiftId: number,
  now = new Date()
) {
  shiftIdSchema.parse(shiftId);
  const current = await getShift(shiftId);
  authorize(actor, 'shifts.close.own', current.userId);
  if (current.status !== 'OPEN') throw new AppError('CONFLICT');
  if (now.getTime() < current.openedAt.getTime()) throw new AppError('VALIDATION_ERROR');

  return db.transaction(async (tx) => {
    const [shift] = await tx
      .update(shifts)
      .set({
        status: 'CLOSED',
        closedAt: now,
        updatedBy: actor.id,
        updatedAt: new Date()
      })
      .where(and(eq(shifts.id, shiftId), eq(shifts.status, 'OPEN')))
      .returning();
    if (!shift) throw new AppError('CONFLICT');
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'shifts',
      entityId: shift.id,
      action: 'UPDATE',
      oldValues: {status: 'OPEN', closedAt: null},
      newValues: {status: 'CLOSED', closedAt: now.toISOString()},
      relatedShiftId: shift.id
    });
    return shift;
  });
}

export async function correctShift(
  actor: PermissionActor,
  input: {
    shiftId: number;
    openedAt: Date;
    closedAt: Date | null;
    reason: string;
  }
) {
  authorize(actor, 'shifts.correct.all');
  const value = correctShiftSchema.parse(input);
  const current = await getShift(value.shiftId);
  if (current.status === 'CLOSED' && !value.closedAt) {
    throw new AppError('VALIDATION_ERROR');
  }

  return db.transaction(async (tx) => {
    const [shift] = await tx
      .update(shifts)
      .set({
        openedAt: value.openedAt,
        closedAt: current.status === 'OPEN' ? null : value.closedAt,
        updatedBy: actor.id,
        updatedAt: new Date()
      })
      .where(eq(shifts.id, value.shiftId))
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'shifts',
      entityId: shift.id,
      action: 'CORRECT',
      oldValues: {
        openedAt: current.openedAt.toISOString(),
        closedAt: current.closedAt?.toISOString() ?? null
      },
      newValues: {
        openedAt: shift.openedAt.toISOString(),
        closedAt: shift.closedAt?.toISOString() ?? null
      },
      reason: value.reason,
      relatedShiftId: shift.id
    });
    return shift;
  });
}

export async function reopenShift(
  actor: PermissionActor,
  input: {shiftId: number; reason: string}
) {
  authorize(actor, 'shifts.reopen.all');
  const value = reopenShiftSchema.parse(input);
  const current = await getShift(value.shiftId);
  if (current.status !== 'CLOSED') throw new AppError('CONFLICT');

  try {
    return await db.transaction(async (tx) => {
      const [shift] = await tx
        .update(shifts)
        .set({
          status: 'OPEN',
          closedAt: null,
          updatedBy: actor.id,
          updatedAt: new Date()
        })
        .where(and(eq(shifts.id, value.shiftId), eq(shifts.status, 'CLOSED')))
        .returning();
      if (!shift) throw new AppError('CONFLICT');
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'shifts',
        entityId: shift.id,
        action: 'REOPEN',
        oldValues: {
          status: 'CLOSED',
          closedAt: current.closedAt?.toISOString() ?? null
        },
        newValues: {status: 'OPEN', closedAt: null},
        reason: value.reason,
        relatedShiftId: shift.id
      });
      return shift;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError('SHIFT_ALREADY_OPEN');
    throw error;
  }
}

export async function requireActiveShift(
  actorId: number,
  executor: QueryExecutor = db
) {
  const [shift] = await executor
    .select()
    .from(shifts)
    .where(and(eq(shifts.userId, actorId), eq(shifts.status, 'OPEN')))
    .limit(1);
  if (!shift) throw new AppError('SHIFT_REQUIRED');
  return shift;
}

export async function getShiftSummary(shiftId: number) {
  shiftIdSchema.parse(shiftId);
  const shift = await getShift(shiftId);
  const result = await db.execute<{
    sales_total: string;
    expenses_total: string;
    stock_received: number;
  }>(sql`
    select
      coalesce((select sum(total) from sales where shift_id = ${shiftId} and status = 'COMPLETED'), 0)::text as sales_total,
      coalesce((select sum(amount) from expenses where shift_id = ${shiftId} and status = 'ACTIVE'), 0)::text as expenses_total,
      coalesce((select sum(quantity) from stock_receipts where shift_id = ${shiftId} and status = 'ACTIVE'), 0)::integer as stock_received
  `);
  const totals = result.rows[0];
  return {
    shift,
    salesTotal: new Decimal(totals.sales_total).toFixed(2),
    expensesTotal: new Decimal(totals.expenses_total).toFixed(2),
    stockReceived: totals.stock_received
  };
}
