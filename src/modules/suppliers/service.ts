import {eq, sql} from 'drizzle-orm';
import Decimal from 'decimal.js';

import {db, type DbTransaction} from '@/db/client';
import {supplierPayments, suppliers} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {getCashSnapshot, lockCashLedger} from '@/modules/accounts/cash';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {
  supplierIdSchema,
  supplierInputSchema,
  supplierPaymentSchema,
  supplierUpdateSchema
} from './schemas';

type SupplierInput = {
  name: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  note?: string;
};

function databaseCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('cause' in error)) return undefined;
  const cause = error.cause;
  return typeof cause === 'object' && cause !== null && 'code' in cause
    ? String(cause.code)
    : undefined;
}

async function translateConflict<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (databaseCode(error) === '23505') throw new AppError('CONFLICT');
    throw error;
  }
}

export async function createSupplier(actor: PermissionActor, rawInput: SupplierInput) {
  authorize(actor, 'suppliers.manage.all');
  const input = supplierInputSchema.parse(rawInput);
  return translateConflict(() =>
    db.transaction(async (tx) => {
      const [supplier] = await tx
        .insert(suppliers)
        .values({...input, createdBy: actor.id, updatedBy: actor.id})
        .returning();
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'suppliers',
        entityId: supplier.id,
        action: 'CREATE',
        newValues: {name: supplier.name, phone: supplier.phone}
      });
      return supplier;
    })
  );
}

export async function updateSupplier(
  actor: PermissionActor,
  rawInput: SupplierInput & {id: number}
) {
  authorize(actor, 'suppliers.manage.all');
  const input = supplierUpdateSchema.parse(rawInput);
  const {id, ...changes} = input;
  return translateConflict(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .for('update');
      if (!current) throw new AppError('NOT_FOUND');
      const [supplier] = await tx
        .update(suppliers)
        .set({...changes, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(suppliers.id, id))
        .returning();
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'suppliers',
        entityId: supplier.id,
        action: 'UPDATE',
        oldValues: {name: current.name, phone: current.phone},
        newValues: {name: supplier.name, phone: supplier.phone}
      });
      return supplier;
    })
  );
}

async function supplierBalance(
  tx: DbTransaction,
  supplierId: number
) {
  const result = await tx.execute<{balance: string}>(sql`
    select (
      coalesce((select sum(total_cost) from stock_receipts where supplier_id = ${supplierId} and status = 'ACTIVE'), 0)
      - coalesce((select sum(amount) from supplier_payments where supplier_id = ${supplierId} and status = 'ACTIVE'), 0)
    )::numeric(14,2)::text as balance
  `);
  return result.rows[0]?.balance ?? '0.00';
}

export async function setSupplierActive(
  actor: PermissionActor,
  rawId: number,
  isActive: boolean
) {
  authorize(actor, 'suppliers.manage.all');
  const id = supplierIdSchema.parse(rawId);
  return translateConflict(() =>
    db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, id))
        .for('update');
      if (!current) throw new AppError('NOT_FOUND');
      if (current.isActive === isActive) return current;
      if (!isActive && Number(await supplierBalance(tx, id)) !== 0) {
        throw new AppError('CONFLICT');
      }
      const [supplier] = await tx
        .update(suppliers)
        .set({isActive, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(suppliers.id, id))
        .returning();
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'suppliers',
        entityId: id,
        action: isActive ? 'RESTORE' : 'ARCHIVE',
        oldValues: {isActive: current.isActive},
        newValues: {isActive}
      });
      return supplier;
    })
  );
}

export async function recordSupplierPayment(
  actor: PermissionActor,
  rawInput: {
    supplierId: number;
    amount: string;
    occurredAt?: Date;
    reference?: string;
    note?: string;
  }
) {
  authorize(actor, 'suppliers.pay.all');
  const input = supplierPaymentSchema.parse(rawInput);
  return db.transaction(async (tx) => {
    await lockCashLedger(tx);
    const [supplier] = await tx
      .select({id: suppliers.id, isActive: suppliers.isActive})
      .from(suppliers)
      .where(eq(suppliers.id, input.supplierId))
      .for('update');
    if (!supplier) throw new AppError('NOT_FOUND');
    if (!supplier.isActive) throw new AppError('CONFLICT');
    const cash = await getCashSnapshot(tx);
    if (new Decimal(input.amount).greaterThan(cash.cash)) {
      throw new AppError('INSUFFICIENT_CASH');
    }
    const [payment] = await tx
      .insert(supplierPayments)
      .values({...input, occurredAt: input.occurredAt ?? new Date(), operatorId: actor.id})
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'supplier_payments',
      entityId: payment.id,
      action: 'CREATE',
      newValues: {supplierId: payment.supplierId, amount: payment.amount},
      relatedTransactionType: 'SUPPLIER_PAYMENT',
      relatedTransactionId: payment.id
    });
    return payment;
  });
}
