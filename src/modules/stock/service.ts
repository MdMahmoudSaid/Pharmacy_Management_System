import {desc, eq, sql} from 'drizzle-orm';

import {db, type DbTransaction} from '@/db/client';
import {medicines, stockMovements, stockReceipts} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {requireActiveShift} from '@/modules/shifts/service';
import {correctStockReceiptSchema, receiveStockSchema} from './schemas';

async function lockMedicines(tx: DbTransaction, ids: number[]) {
  const ordered = [...new Set(ids)].sort((left, right) => left - right);
  const result = await tx.execute<{
    id: number;
    current_stock: number;
    is_active: boolean;
  }>(sql`
    select id, current_stock, is_active
    from medicines
    where id in (${sql.join(ordered.map((id) => sql`${id}`), sql`, `)})
    order by id
    for update
  `);
  if (result.rows.length !== ordered.length) throw new AppError('NOT_FOUND');
  return new Map(result.rows.map((row) => [Number(row.id), row]));
}

export async function receiveStock(
  actor: PermissionActor,
  input: {medicineId: number; quantity: number; note?: string},
  existingTx?: DbTransaction
) {
  authorize(actor, 'stock.receive.own', actor.id);
  const value = receiveStockSchema.parse(input);
  const operation = async (tx: DbTransaction) => {
    const shift = await requireActiveShift(actor.id, tx);
    const locked = await lockMedicines(tx, [value.medicineId]);
    const medicine = locked.get(value.medicineId)!;
    if (!medicine.is_active) throw new AppError('CONFLICT');
    const after = medicine.current_stock + value.quantity;
    await tx
      .update(medicines)
      .set({currentStock: after, updatedBy: actor.id, updatedAt: new Date()})
      .where(eq(medicines.id, value.medicineId));
    const [receipt] = await tx
      .insert(stockReceipts)
      .values({
        medicineId: value.medicineId,
        quantity: value.quantity,
        shiftId: shift.id,
        operatorId: actor.id,
        note: value.note,
        createdBy: actor.id,
        updatedBy: actor.id
      })
      .returning();
    await tx.insert(stockMovements).values({
      medicineId: value.medicineId,
      type: 'STOCK_RECEIVED',
      quantityBefore: medicine.current_stock,
      quantityChange: value.quantity,
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
        medicineId: value.medicineId,
        quantity: value.quantity
      },
      relatedShiftId: shift.id,
      relatedTransactionType: 'STOCK_RECEIPT',
      relatedTransactionId: receipt.id
    });
    return receipt;
  };
  return existingTx ? operation(existingTx) : db.transaction(operation);
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
      await tx
        .update(medicines)
        .set({currentStock: after, updatedBy: actor.id, updatedAt: new Date()})
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
      await tx
        .update(medicines)
        .set({currentStock: oldAfter, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(medicines.id, receipt.medicineId));
      await tx
        .update(medicines)
        .set({currentStock: newAfter, updatedBy: actor.id, updatedAt: new Date()})
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

export async function getMedicineMovements(filters: {medicineId?: number} = {}) {
  const query = db
    .select({movement: stockMovements, medicineName: medicines.name})
    .from(stockMovements)
    .innerJoin(medicines, eq(medicines.id, stockMovements.medicineId))
    .orderBy(desc(stockMovements.createdAt));
  if (filters.medicineId) {
    return query.where(eq(stockMovements.medicineId, filters.medicineId));
  }
  return query;
}
