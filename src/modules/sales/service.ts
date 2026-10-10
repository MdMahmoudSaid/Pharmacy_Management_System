import {randomUUID} from 'node:crypto';

import Decimal from 'decimal.js';
import {and, eq, sql} from 'drizzle-orm';

import {db, type Database, type DbTransaction} from '@/db/client';
import {medicines, saleItems, sales, stockMovements} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {requireActiveShift} from '@/modules/shifts/service';
import {authorizePriceOverride, authorizeSaleCreation} from './permissions';
import {createSaleSchema, priceOverrideReasonSchema} from './schemas';

type Executor = Database | DbTransaction;
type SaleInput = {
  shiftId: number;
  idempotencyKey: string;
  items: Array<{
    medicineId: number;
    quantity: number;
    unitPrice?: string;
    overrideReason?: string;
  }>;
};

export type SaleView = {
  id: number;
  saleNumber: string;
  shiftId: number;
  operatorId: number;
  total: string;
  status: 'COMPLETED' | 'CANCELLED';
  items: Array<{
    id: number;
    medicineId: number;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
};

async function saleView(executor: Executor, saleId: number): Promise<SaleView> {
  const [sale] = await executor.select().from(sales).where(eq(sales.id, saleId));
  if (!sale) throw new AppError('NOT_FOUND');
  const items = await executor
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, saleId));
  return {...sale, items};
}

async function priorSale(
  executor: Executor,
  operatorId: number,
  idempotencyKey: string
) {
  const [sale] = await executor
    .select({id: sales.id})
    .from(sales)
    .where(
      and(
        eq(sales.operatorId, operatorId),
        eq(sales.idempotencyKey, idempotencyKey)
      )
    )
    .limit(1);
  return sale ? saleView(executor, sale.id) : null;
}

async function createSaleTransaction(actor: PermissionActor, input: SaleInput) {
  return db.transaction(async (tx) => {
    const existing = await priorSale(tx, actor.id, input.idempotencyKey);
    if (existing) return existing;
    const shift = await requireActiveShift(actor.id, tx);
    if (shift.id !== input.shiftId) throw new AppError('SHIFT_REQUIRED');

    const medicineIds = input.items
      .map(({medicineId}) => medicineId)
      .sort((left, right) => left - right);
    const locked = await tx.execute<{
      id: number;
      selling_price: string;
      current_stock: number;
      is_active: boolean;
    }>(sql`
      select id, selling_price, current_stock, is_active
      from medicines
      where id in (${sql.join(medicineIds.map((id) => sql`${id}`), sql`, `)})
      order by id
      for update
    `);
    if (locked.rows.length !== medicineIds.length) throw new AppError('NOT_FOUND');

    const committedWhileWaiting = await priorSale(
      tx,
      actor.id,
      input.idempotencyKey
    );
    if (committedWhileWaiting) return committedWhileWaiting;

    const byId = new Map(locked.rows.map((row) => [Number(row.id), row]));
    const prepared = input.items.map((item) => {
      const medicine = byId.get(item.medicineId)!;
      if (!medicine.is_active) throw new AppError('CONFLICT');
      if (medicine.current_stock < item.quantity) {
        throw new AppError('INSUFFICIENT_STOCK');
      }
      const selectedPrice = item.unitPrice ?? medicine.selling_price;
      if (selectedPrice !== medicine.selling_price) {
        authorizePriceOverride(actor);
        priceOverrideReasonSchema.parse(item.overrideReason);
      }
      return {
        ...item,
        unitPrice: selectedPrice,
        lineTotal: new Decimal(selectedPrice).times(item.quantity).toFixed(2),
        before: medicine.current_stock,
        after: medicine.current_stock - item.quantity
      };
    });
    const total = prepared
      .reduce((sum, item) => sum.plus(item.lineTotal), new Decimal(0))
      .toFixed(2);
    const [sale] = await tx
      .insert(sales)
      .values({
        saleNumber: `S-${Date.now()}-${randomUUID().slice(0, 8)}`,
        shiftId: shift.id,
        operatorId: actor.id,
        total,
        idempotencyKey: input.idempotencyKey,
        createdBy: actor.id,
        updatedBy: actor.id
      })
      .returning();
    await tx.insert(saleItems).values(
      prepared.map((item) => ({
        saleId: sale.id,
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal
      }))
    );
    for (const item of prepared) {
      await tx
        .update(medicines)
        .set({currentStock: item.after, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(medicines.id, item.medicineId));
    }
    await tx.insert(stockMovements).values(
      prepared.map((item) => ({
        medicineId: item.medicineId,
        type: 'SALE' as const,
        quantityBefore: item.before,
        quantityChange: -item.quantity,
        quantityAfter: item.after,
        relatedEntityType: 'SALE' as const,
        relatedEntityId: sale.id,
        shiftId: shift.id,
        actorId: actor.id,
        reason:
          item.unitPrice !== byId.get(item.medicineId)!.selling_price
            ? item.overrideReason
            : undefined
      }))
    );
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'sales',
      entityId: sale.id,
      action: 'CREATE',
      newValues: {total, itemCount: prepared.length},
      relatedShiftId: shift.id,
      relatedTransactionType: 'SALE',
      relatedTransactionId: sale.id
    });
    return saleView(tx, sale.id);
  });
}

const errorCode = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'code' in error.cause
  ) {
    return String(error.cause.code);
  }
  return undefined;
};

export async function createSale(actor: PermissionActor, rawInput: SaleInput) {
  authorizeSaleCreation(actor);
  const input = createSaleSchema.parse(rawInput);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createSaleTransaction(actor, input);
    } catch (error) {
      const code = errorCode(error);
      if ((code === '40001' || code === '40P01') && attempt < 2) continue;
      if (code === '23505') {
        const existing = await priorSale(db, actor.id, input.idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }
  }
  throw new AppError('INTERNAL_ERROR');
}
