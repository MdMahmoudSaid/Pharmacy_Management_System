import {randomUUID} from 'node:crypto';

import Decimal from 'decimal.js';
import {and, asc, eq, inArray, sql} from 'drizzle-orm';

import {db, type Database, type DbTransaction} from '@/db/client';
import {
  auditLogs,
  medicines,
  saleItems,
  sales,
  shifts,
  stockMovements,
  users
} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {requireActiveShift} from '@/modules/shifts/service';
import {
  authorizePriceOverride,
  authorizeSaleCancellation,
  authorizeSaleCorrection,
  authorizeSaleCreation,
  authorizeSaleView
} from './permissions';
import {
  createSaleSchema,
  priceOverrideReasonSchema,
  replacementSaleItemsSchema,
  saleChangeReasonSchema,
  saleIdSchema
} from './schemas';

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

type ReplacementItem = SaleInput['items'][number];

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

async function lockedSale(tx: DbTransaction, saleId: number) {
  const [sale] = await tx
    .select()
    .from(sales)
    .where(eq(sales.id, saleId))
    .for('update');
  if (!sale) throw new AppError('NOT_FOUND');
  return sale;
}

async function lockedMedicines(tx: DbTransaction, medicineIds: number[]) {
  const rows = await tx.execute<{
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
  if (rows.rows.length !== medicineIds.length) throw new AppError('NOT_FOUND');
  return new Map(rows.rows.map((row) => [Number(row.id), row]));
}

const retryableTransaction = async <T>(operation: () => Promise<T>) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = errorCode(error);
      if ((code === '40001' || code === '40P01') && attempt < 2) continue;
      throw error;
    }
  }
  throw new AppError('INTERNAL_ERROR');
};

export async function correctSale(
  actor: PermissionActor,
  rawSaleId: number,
  rawItems: ReplacementItem[],
  rawReason: string
) {
  const saleId = saleIdSchema.parse(rawSaleId);
  const items = replacementSaleItemsSchema.parse(rawItems);
  const reason = saleChangeReasonSchema.parse(rawReason);

  return retryableTransaction(() =>
    db.transaction(async (tx) => {
      const sale = await lockedSale(tx, saleId);
      authorizeSaleCorrection(actor, sale.operatorId);
      if (sale.status !== 'COMPLETED') throw new AppError('CONFLICT');

      const oldItems = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, saleId));
      const medicineIds = [
        ...new Set([
          ...oldItems.map(({medicineId}) => medicineId),
          ...items.map(({medicineId}) => medicineId)
        ])
      ].sort((left, right) => left - right);
      const locked = await lockedMedicines(tx, medicineIds);
      const replacementIds = new Set(items.map(({medicineId}) => medicineId));
      for (const medicineId of replacementIds) {
        if (!locked.get(medicineId)!.is_active) throw new AppError('CONFLICT');
      }

      const balances = new Map(
        [...locked].map(([id, medicine]) => [id, medicine.current_stock])
      );
      const movementValues: Array<typeof stockMovements.$inferInsert> = [];
      for (const item of [...oldItems].sort(
        (left, right) => left.medicineId - right.medicineId
      )) {
        const before = balances.get(item.medicineId)!;
        const after = before + item.quantity;
        balances.set(item.medicineId, after);
        movementValues.push({
          medicineId: item.medicineId,
          type: 'SALE_CORRECTION',
          quantityBefore: before,
          quantityChange: item.quantity,
          quantityAfter: after,
          relatedEntityType: 'SALE',
          relatedEntityId: saleId,
          shiftId: sale.shiftId,
          actorId: actor.id,
          reason
        });
      }

      const prepared = [...items]
        .sort((left, right) => left.medicineId - right.medicineId)
        .map((item) => {
          const medicine = locked.get(item.medicineId)!;
          const unitPrice = item.unitPrice ?? medicine.selling_price;
          if (unitPrice !== medicine.selling_price) {
            authorizePriceOverride(actor);
            priceOverrideReasonSchema.parse(item.overrideReason ?? reason);
          }
          const before = balances.get(item.medicineId)!;
          if (before < item.quantity) throw new AppError('INSUFFICIENT_STOCK');
          const after = before - item.quantity;
          balances.set(item.medicineId, after);
          movementValues.push({
            medicineId: item.medicineId,
            type: 'SALE_CORRECTION',
            quantityBefore: before,
            quantityChange: -item.quantity,
            quantityAfter: after,
            relatedEntityType: 'SALE',
            relatedEntityId: saleId,
            shiftId: sale.shiftId,
            actorId: actor.id,
            reason
          });
          return {
            saleId,
            medicineId: item.medicineId,
            quantity: item.quantity,
            unitPrice,
            lineTotal: new Decimal(unitPrice).times(item.quantity).toFixed(2)
          };
        });
      const total = prepared
        .reduce((sum, item) => sum.plus(item.lineTotal), new Decimal(0))
        .toFixed(2);

      await tx.delete(saleItems).where(eq(saleItems.saleId, saleId));
      await tx.insert(saleItems).values(prepared);
      for (const [medicineId, currentStock] of balances) {
        await tx
          .update(medicines)
          .set({currentStock, updatedBy: actor.id, updatedAt: new Date()})
          .where(eq(medicines.id, medicineId));
      }
      await tx.insert(stockMovements).values(movementValues);
      await tx
        .update(sales)
        .set({total, updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(sales.id, saleId));
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'sales',
        entityId: saleId,
        action: 'CORRECT',
        oldValues: {total: sale.total, items: oldItems},
        newValues: {total, items: prepared},
        reason,
        relatedShiftId: sale.shiftId,
        relatedTransactionType: 'SALE',
        relatedTransactionId: saleId
      });
      return saleView(tx, saleId);
    })
  );
}

export async function cancelSale(
  actor: PermissionActor,
  rawSaleId: number,
  rawReason: string
) {
  const saleId = saleIdSchema.parse(rawSaleId);
  const reason = saleChangeReasonSchema.parse(rawReason);

  return retryableTransaction(() =>
    db.transaction(async (tx) => {
      const sale = await lockedSale(tx, saleId);
      authorizeSaleCancellation(actor, sale.operatorId);
      if (sale.status === 'CANCELLED') {
        const [completedCommand] = await tx
          .select({id: auditLogs.id})
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.entityType, 'sales'),
              eq(auditLogs.entityId, saleId),
              eq(auditLogs.action, 'CANCEL'),
              eq(auditLogs.actorId, actor.id),
              eq(auditLogs.reason, reason)
            )
          );
        if (completedCommand) return saleView(tx, saleId);
        throw new AppError('CONFLICT');
      }

      const items = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, saleId));
      const medicineIds = [...new Set(items.map(({medicineId}) => medicineId))].sort(
        (left, right) => left - right
      );
      const locked = await lockedMedicines(tx, medicineIds);
      const movementValues = items
        .sort((left, right) => left.medicineId - right.medicineId)
        .map((item) => {
          const medicine = locked.get(item.medicineId)!;
          const before = medicine.current_stock;
          const after = before + item.quantity;
          medicine.current_stock = after;
          return {
            medicineId: item.medicineId,
            type: 'SALE_CANCELLATION' as const,
            quantityBefore: before,
            quantityChange: item.quantity,
            quantityAfter: after,
            relatedEntityType: 'SALE' as const,
            relatedEntityId: saleId,
            shiftId: sale.shiftId,
            actorId: actor.id,
            reason
          };
        });
      for (const [medicineId, medicine] of locked) {
        await tx
          .update(medicines)
          .set({
            currentStock: medicine.current_stock,
            updatedBy: actor.id,
            updatedAt: new Date()
          })
          .where(eq(medicines.id, medicineId));
      }
      await tx.insert(stockMovements).values(movementValues);
      await tx
        .update(sales)
        .set({status: 'CANCELLED', updatedBy: actor.id, updatedAt: new Date()})
        .where(eq(sales.id, saleId));
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'sales',
        entityId: saleId,
        action: 'CANCEL',
        oldValues: {status: sale.status, total: sale.total},
        newValues: {status: 'CANCELLED', total: sale.total},
        reason,
        relatedShiftId: sale.shiftId,
        relatedTransactionType: 'SALE',
        relatedTransactionId: saleId
      });
      return saleView(tx, saleId);
    })
  );
}

export async function getSaleDetail(
  actor: PermissionActor,
  rawSaleId: number
) {
  const saleId = saleIdSchema.parse(rawSaleId);
  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
  if (!sale) throw new AppError('NOT_FOUND');
  authorizeSaleView(actor, sale.operatorId);

  const [items, audit, [shift]] = await Promise.all([
    db
      .select({
        id: saleItems.id,
        medicineId: saleItems.medicineId,
        medicineName: medicines.name,
        medicineCode: medicines.code,
        quantity: saleItems.quantity,
        unitPrice: saleItems.unitPrice,
        lineTotal: saleItems.lineTotal
      })
      .from(saleItems)
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .where(eq(saleItems.saleId, saleId))
      .orderBy(asc(saleItems.id)),
    db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.entityType, 'sales'), eq(auditLogs.entityId, saleId))
      )
      .orderBy(asc(auditLogs.createdAt)),
    db.select().from(shifts).where(eq(shifts.id, sale.shiftId))
  ]);
  const userIds = [
    ...new Set(
      [sale.operatorId, sale.createdBy, sale.updatedBy, ...audit.map(({actorId}) => actorId)]
        .filter((id): id is number => id !== null)
    )
  ];
  const people = userIds.length
    ? await db
        .select({id: users.id, name: users.name})
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const names = new Map(people.map(({id, name}) => [id, name]));

  return {
    sale,
    items,
    shift,
    operatorName: names.get(sale.operatorId) ?? `#${sale.operatorId}`,
    createdByName: sale.createdBy ? names.get(sale.createdBy) ?? null : null,
    updatedByName: sale.updatedBy ? names.get(sale.updatedBy) ?? null : null,
    audit: audit.map((entry) => ({
      ...entry,
      actorName: names.get(entry.actorId) ?? `#${entry.actorId}`
    }))
  };
}
