import {and, desc, eq, gte, inArray, lt, sql} from 'drizzle-orm';
import Decimal from 'decimal.js';

import {db, type DbTransaction} from '@/db/client';
import {
  medicines,
  stockMovements,
  stockReceipts,
  suppliers,
  users
} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {requireActiveShift} from '@/modules/shifts/service';
import {projectReceiptPricing} from './pricing';
import {
  adjustStockSchema,
  correctStockReceiptSchema,
  receiveStockBatchSchema,
  receiveStockSchema
} from './schemas';

async function lockMedicines(tx: DbTransaction, ids: number[]) {
  const ordered = [...new Set(ids)].sort((left, right) => left - right);
  const result = await tx.execute<{
    id: number;
    current_stock: number;
    average_cost: string;
    is_active: boolean;
  }>(sql`
    select id, current_stock, average_cost, is_active
    from medicines
    where id in (${sql.join(ordered.map((id) => sql`${id}`), sql`, `)})
    order by id
    for update
  `);
  if (result.rows.length !== ordered.length) throw new AppError('NOT_FOUND');
  return new Map(result.rows.map((row) => [Number(row.id), row]));
}

type ReceiptLine = {medicineId: number; quantity: number; totalCost: string; sellingPrice: string};

// Receives one or several medicines from one supplier in a single transaction: either every line is recorded or none.
export async function receiveStockBatch(
  actor: PermissionActor,
  input: {supplierId: number; note?: string; lines: ReceiptLine[]},
  existingTx?: DbTransaction
) {
  authorize(actor, 'stock.receive.own', actor.id);
  const value = receiveStockBatchSchema.parse(input);
  const operation = async (tx: DbTransaction) => {
    const shift = await requireActiveShift(actor.id, tx);
    const locked = await lockMedicines(tx, value.lines.map(({medicineId}) => medicineId));
    const [supplier] = await tx
      .select({id: suppliers.id, isActive: suppliers.isActive})
      .from(suppliers)
      .where(eq(suppliers.id, value.supplierId))
      .for('update');
    if (!supplier) throw new AppError('NOT_FOUND');
    if (!supplier.isActive) throw new AppError('CONFLICT');
    const receipts = [];
    for (const line of value.lines) {
      const medicine = locked.get(line.medicineId)!;
      if (!medicine.is_active) throw new AppError('CONFLICT');
      const after = medicine.current_stock + line.quantity;
      const projection = projectReceiptPricing({
        currentStock: medicine.current_stock,
        averageCost: medicine.average_cost,
        quantity: line.quantity,
        totalCost: line.totalCost
      });
      // A unit cost that rounds to nothing cannot be recorded.
      if (new Decimal(projection.unitCost).lessThanOrEqualTo(0)) throw new AppError('VALIDATION_ERROR');
      if (new Decimal(line.sellingPrice).lessThanOrEqualTo(projection.projectedAverageCost)) {
        throw new AppError('VALIDATION_ERROR');
      }
      await tx
        .update(medicines)
        .set({
          currentStock: after,
          averageCost: projection.projectedAverageCost,
          sellingPrice: line.sellingPrice,
          updatedBy: actor.id,
          updatedAt: new Date()
        })
        .where(eq(medicines.id, line.medicineId));
      const [receipt] = await tx
        .insert(stockReceipts)
        .values({
          medicineId: line.medicineId,
          supplierId: value.supplierId,
          quantity: line.quantity,
          unitCost: projection.unitCost,
          totalCost: projection.totalCost,
          shiftId: shift.id,
          operatorId: actor.id,
          note: value.note,
          createdBy: actor.id,
          updatedBy: actor.id
        })
        .returning();
      await tx.insert(stockMovements).values({
        medicineId: line.medicineId,
        type: 'STOCK_RECEIVED',
        quantityBefore: medicine.current_stock,
        quantityChange: line.quantity,
        quantityAfter: after,
        relatedEntityType: 'STOCK_RECEIPT',
        relatedEntityId: receipt.id,
        shiftId: shift.id,
        actorId: actor.id,
        note: value.note
      });
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'stock_receipts',
        entityId: receipt.id,
        action: 'CREATE',
        newValues: {
          medicineId: line.medicineId,
          supplierId: value.supplierId,
          quantity: line.quantity,
          unitCost: projection.unitCost,
          totalCost: projection.totalCost,
          projectedAverageCost: projection.projectedAverageCost,
          sellingPrice: line.sellingPrice
        },
        relatedShiftId: shift.id,
        relatedTransactionType: 'STOCK_RECEIPT',
        relatedTransactionId: receipt.id
      });
      receipts.push(receipt);
    }
    return receipts;
  };
  return existingTx ? operation(existingTx) : db.transaction(operation);
}

export async function receiveStock(
  actor: PermissionActor,
  input: {
    medicineId: number;
    supplierId: number;
    quantity: number;
    unitCost: string;
    sellingPrice: string;
    note?: string;
  },
  existingTx?: DbTransaction
) {
  const value = receiveStockSchema.parse(input);
  const [receipt] = await receiveStockBatch(
    actor,
    {
      supplierId: value.supplierId,
      note: value.note,
      lines: [{
        medicineId: value.medicineId,
        quantity: value.quantity,
        totalCost: new Decimal(value.unitCost).times(value.quantity).toFixed(2),
        sellingPrice: value.sellingPrice
      }]
    },
    existingTx
  );
  return receipt;
}

export async function correctStockReceipt(
  actor: PermissionActor,
  input: {
    receiptId: number;
    medicineId: number;
    quantity: number;
    reason: string;
  }
) {
  authorize(actor, 'stock.correct.all');
  const value = correctStockReceiptSchema.parse(input);
  return db.transaction(async (tx) => {
    const [receipt] = await tx
      .select()
      .from(stockReceipts)
      .where(eq(stockReceipts.id, value.receiptId))
      .limit(1);
    if (!receipt) throw new AppError('NOT_FOUND');
    if (receipt.status !== 'ACTIVE') throw new AppError('CONFLICT');
    const locked = await lockMedicines(tx, [receipt.medicineId, value.medicineId]);
    const oldMedicine = locked.get(receipt.medicineId)!;
    const newMedicine = locked.get(value.medicineId)!;
    if (!newMedicine.is_active && value.medicineId !== receipt.medicineId) {
      throw new AppError('CONFLICT');
    }

    if (receipt.medicineId === value.medicineId) {
      const difference = value.quantity - receipt.quantity;
      const after = oldMedicine.current_stock + difference;
      if (after < 0) throw new AppError('INSUFFICIENT_STOCK');
      const adjustedValue = new Decimal(oldMedicine.average_cost)
        .times(oldMedicine.current_stock)
        .plus(new Decimal(receipt.unitCost ?? 0).times(difference));
      if (adjustedValue.isNegative()) throw new AppError('CONFLICT');
      const averageCost = after === 0 ? '0.00' : adjustedValue.dividedBy(after).toFixed(2);
      await tx
        .update(medicines)
        .set({currentStock: after, averageCost, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(medicines.id, receipt.medicineId));
      await tx.insert(stockMovements).values({
        medicineId: receipt.medicineId,
        type: 'STOCK_RECEIPT_CORRECTION',
        quantityBefore: oldMedicine.current_stock,
        quantityChange: difference,
        quantityAfter: after,
        relatedEntityType: 'STOCK_RECEIPT',
        relatedEntityId: receipt.id,
        shiftId: receipt.shiftId,
        actorId: actor.id,
        reason: value.reason
      });
    } else {
      const oldAfter = oldMedicine.current_stock - receipt.quantity;
      if (oldAfter < 0) throw new AppError('INSUFFICIENT_STOCK');
      const newAfter = newMedicine.current_stock + value.quantity;
      const receiptCost = new Decimal(receipt.unitCost ?? 0);
      const oldValue = new Decimal(oldMedicine.average_cost)
        .times(oldMedicine.current_stock)
        .minus(receiptCost.times(receipt.quantity));
      if (oldValue.isNegative()) throw new AppError('CONFLICT');
      const oldAverageCost = oldAfter === 0 ? '0.00' : oldValue.dividedBy(oldAfter).toFixed(2);
      const newAverageCost = new Decimal(newMedicine.average_cost)
        .times(newMedicine.current_stock)
        .plus(receiptCost.times(value.quantity))
        .dividedBy(newAfter)
        .toFixed(2);
      await tx
        .update(medicines)
        .set({currentStock: oldAfter, averageCost: oldAverageCost, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(medicines.id, receipt.medicineId));
      await tx
        .update(medicines)
        .set({currentStock: newAfter, averageCost: newAverageCost, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(medicines.id, value.medicineId));
      await tx.insert(stockMovements).values([
        {
          medicineId: receipt.medicineId,
          type: 'STOCK_RECEIPT_CORRECTION' as const,
          quantityBefore: oldMedicine.current_stock,
          quantityChange: -receipt.quantity,
          quantityAfter: oldAfter,
          relatedEntityType: 'STOCK_RECEIPT' as const,
          relatedEntityId: receipt.id,
          shiftId: receipt.shiftId,
          actorId: actor.id,
          reason: value.reason
        },
        {
          medicineId: value.medicineId,
          type: 'STOCK_RECEIPT_CORRECTION' as const,
          quantityBefore: newMedicine.current_stock,
          quantityChange: value.quantity,
          quantityAfter: newAfter,
          relatedEntityType: 'STOCK_RECEIPT' as const,
          relatedEntityId: receipt.id,
          shiftId: receipt.shiftId,
          actorId: actor.id,
          reason: value.reason
        }
      ]);
    }

    const [corrected] = await tx
      .update(stockReceipts)
      .set({
        medicineId: value.medicineId,
        quantity: value.quantity,
        totalCost: receipt.unitCost
          ? new Decimal(receipt.unitCost).times(value.quantity).toFixed(2)
          : null,
        updatedBy: actor.id,
        updatedAt: new Date()
      })
      .where(eq(stockReceipts.id, receipt.id))
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'stock_receipts',
      entityId: receipt.id,
      action: 'CORRECT',
      oldValues: {medicineId: receipt.medicineId, quantity: receipt.quantity},
      newValues: {medicineId: value.medicineId, quantity: value.quantity},
      reason: value.reason,
      relatedShiftId: receipt.shiftId,
      relatedTransactionType: 'STOCK_RECEIPT',
      relatedTransactionId: receipt.id
    });
    return corrected;
  });
}

export async function adjustStock(
  actor: PermissionActor,
  input: {medicineId: number; quantityChange: number; reason: string}
) {
  authorize(actor, 'stock.adjust.all');
  const value = adjustStockSchema.parse(input);
  return db.transaction(async (tx) => {
    const locked = await lockMedicines(tx, [value.medicineId]);
    const medicine = locked.get(value.medicineId)!;
    if (!medicine.is_active) throw new AppError('CONFLICT');
    const after = medicine.current_stock + value.quantityChange;
    if (after < 0) throw new AppError('INSUFFICIENT_STOCK');
    const [updated] = await tx
      .update(medicines)
      .set({currentStock: after, updatedBy: actor.id, updatedAt: new Date()})
      .where(eq(medicines.id, value.medicineId))
      .returning();
    const [movement] = await tx
      .insert(stockMovements)
      .values({
        medicineId: value.medicineId,
        type: 'MANUAL_CORRECTION',
        quantityBefore: medicine.current_stock,
        quantityChange: value.quantityChange,
        quantityAfter: after,
        relatedEntityType: 'MEDICINE',
        relatedEntityId: value.medicineId,
        actorId: actor.id,
        reason: value.reason
      })
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'medicines',
      entityId: value.medicineId,
      action: 'CORRECT',
      oldValues: {currentStock: medicine.current_stock},
      newValues: {currentStock: after, quantityChange: value.quantityChange},
      reason: value.reason,
      relatedTransactionType: 'STOCK_MOVEMENT',
      relatedTransactionId: movement.id
    });
    return updated;
  });
}

export type MovementType = (typeof stockMovements.type.enumValues)[number];

export async function getMedicineMovements(
  filters: {medicineId?: number; types?: MovementType[]; from?: Date; to?: Date; limit?: number} = {}
) {
  return db
    .select({
      movement: stockMovements,
      medicineName: medicines.name,
      actorName: users.name,
      supplierName: suppliers.name,
      unitCost: stockReceipts.unitCost,
      totalCost: stockReceipts.totalCost
    })
    .from(stockMovements)
    .innerJoin(medicines, eq(medicines.id, stockMovements.medicineId))
    .innerJoin(users, eq(users.id, stockMovements.actorId))
    .leftJoin(
      stockReceipts,
      and(
        eq(stockMovements.relatedEntityType, 'STOCK_RECEIPT'),
        eq(stockMovements.relatedEntityId, stockReceipts.id)
      )
    )
    .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
    .where(
      and(
        filters.medicineId ? eq(stockMovements.medicineId, filters.medicineId) : undefined,
        filters.types?.length ? inArray(stockMovements.type, filters.types) : undefined,
        filters.from ? gte(stockMovements.createdAt, filters.from) : undefined,
        filters.to ? lt(stockMovements.createdAt, filters.to) : undefined
      )
    )
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(filters.limit ?? 300);
}
