import Decimal from 'decimal.js';
import {and, asc, eq, ilike, inArray, sql} from 'drizzle-orm';

import {db} from '@/db/client';
import {
  medicines,
  stockReceipts,
  supplierDebts,
  supplierPayments,
  suppliers
} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {authorize, can, type PermissionActor} from '@/modules/permissions/service';
import {supplierIdSchema} from './schemas';

export async function listSuppliers(
  actor: PermissionActor,
  filters: {includeArchived?: boolean; search?: string} = {}
) {
  authorize(actor, 'suppliers.view.all');
  const search = filters.search?.trim();
  const suppliersRows = await db
    .select()
    .from(suppliers)
    .where(
      and(
        filters.includeArchived ? undefined : eq(suppliers.isActive, true),
        search ? ilike(suppliers.name, `%${search}%`) : undefined
      )
    )
    .orderBy(asc(suppliers.name));
  const ids = suppliersRows.map(({id}) => id);
  const [purchaseRows, paymentRows, debtRows] = ids.length
    ? await Promise.all([
        db
          .select({
            supplierId: stockReceipts.supplierId,
            amount: sql<string>`coalesce(sum(${stockReceipts.totalCost}), 0)::numeric(14,2)::text`
          })
          .from(stockReceipts)
          .where(and(inArray(stockReceipts.supplierId, ids), eq(stockReceipts.status, 'ACTIVE')))
          .groupBy(stockReceipts.supplierId),
        db
          .select({
            supplierId: supplierPayments.supplierId,
            amount: sql<string>`coalesce(sum(${supplierPayments.amount}), 0)::numeric(14,2)::text`
          })
          .from(supplierPayments)
          .where(and(inArray(supplierPayments.supplierId, ids), eq(supplierPayments.status, 'ACTIVE')))
          .groupBy(supplierPayments.supplierId),
        db
          .select({
            supplierId: supplierDebts.supplierId,
            amount: sql<string>`coalesce(sum(${supplierDebts.amount}), 0)::numeric(14,2)::text`
          })
          .from(supplierDebts)
          .where(and(inArray(supplierDebts.supplierId, ids), eq(supplierDebts.status, 'ACTIVE')))
          .groupBy(supplierDebts.supplierId)
      ])
    : [[], [], []];
  const purchaseBySupplier = new Map(purchaseRows.map((row) => [row.supplierId, row.amount]));
  const paymentBySupplier = new Map(paymentRows.map((row) => [row.supplierId, row.amount]));
  const debtBySupplier = new Map(debtRows.map((row) => [row.supplierId, row.amount]));
  const items = suppliersRows.map((supplier) => {
    const purchases = purchaseBySupplier.get(supplier.id) ?? '0.00';
    const payments = paymentBySupplier.get(supplier.id) ?? '0.00';
    const debts = debtBySupplier.get(supplier.id) ?? '0.00';
    return {
      ...supplier,
      purchases,
      debts,
      charges: new Decimal(purchases).plus(debts).toFixed(2),
      payments,
      balance: new Decimal(purchases).plus(debts).minus(payments).toFixed(2)
    };
  });
  const totals = items.reduce(
    (sum, item) => {
      const balance = new Decimal(item.balance);
      return {
        debt: sum.debt.plus(Decimal.max(balance, 0)),
        advances: sum.advances.plus(Decimal.max(balance.negated(), 0)),
        purchases: sum.purchases.plus(item.purchases),
        payments: sum.payments.plus(item.payments)
      };
    },
    {debt: new Decimal(0), advances: new Decimal(0), purchases: new Decimal(0), payments: new Decimal(0)}
  );
  return {
    items,
    totals: Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, value.toFixed(2)])
    ) as {debt: string; advances: string; purchases: string; payments: string}
  };
}

export async function listActiveSuppliers(actor: PermissionActor) {
  if (!can(actor, 'suppliers.view.all')) authorize(actor, 'stock.receive.own', actor.id);
  return db
    .select({id: suppliers.id, name: suppliers.name})
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name));
}

export async function getSupplierDetail(actor: PermissionActor, rawId: number) {
  authorize(actor, 'suppliers.view.all');
  const id = supplierIdSchema.parse(rawId);
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  if (!supplier) throw new AppError('NOT_FOUND');

  const [receipts, payments, debts] = await Promise.all([
    db
      .select({
        id: stockReceipts.id,
        occurredAt: stockReceipts.occurredAt,
        amount: stockReceipts.totalCost,
        quantity: stockReceipts.quantity,
        unitCost: stockReceipts.unitCost,
        medicineId: medicines.id,
        medicineName: medicines.name,
        note: stockReceipts.note
      })
      .from(stockReceipts)
      .innerJoin(medicines, eq(medicines.id, stockReceipts.medicineId))
      .where(and(eq(stockReceipts.supplierId, id), eq(stockReceipts.status, 'ACTIVE')))
      .orderBy(asc(stockReceipts.occurredAt), asc(stockReceipts.id)),
    db
      .select()
      .from(supplierPayments)
      .where(and(eq(supplierPayments.supplierId, id), eq(supplierPayments.status, 'ACTIVE')))
      .orderBy(asc(supplierPayments.occurredAt), asc(supplierPayments.id)),
    db
      .select()
      .from(supplierDebts)
      .where(and(eq(supplierDebts.supplierId, id), eq(supplierDebts.status, 'ACTIVE')))
      .orderBy(asc(supplierDebts.occurredAt), asc(supplierDebts.id))
  ]);

  const entries = [
    ...receipts.map((receipt) => ({
      kind: 'RECEIPT' as const,
      id: receipt.id,
      occurredAt: receipt.occurredAt,
      amount: receipt.amount ?? '0.00',
      medicineId: receipt.medicineId,
      medicineName: receipt.medicineName,
      quantity: receipt.quantity,
      unitCost: receipt.unitCost,
      reference: null,
      note: receipt.note
    })),
    ...debts.map((debt) => ({
      kind: 'DEBT' as const,
      id: debt.id,
      occurredAt: debt.occurredAt,
      amount: debt.amount,
      medicineId: null,
      medicineName: null,
      quantity: null,
      unitCost: null,
      reference: null,
      note: debt.note
    })),
    ...payments.map((payment) => ({
      kind: 'PAYMENT' as const,
      id: payment.id,
      occurredAt: payment.occurredAt,
      amount: payment.amount,
      medicineId: null,
      medicineName: null,
      quantity: null,
      unitCost: null,
      reference: payment.reference,
      note: payment.note
    }))
  ].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() ||
      left.id - right.id ||
      left.kind.localeCompare(right.kind)
  );
  let running = new Decimal(0);
  const ledger = entries.map((entry) => {
    running = entry.kind === 'PAYMENT' ? running.minus(entry.amount) : running.plus(entry.amount);
    return {...entry, runningBalance: running.toFixed(2)};
  });
  const purchases = receipts.reduce((sum, row) => sum.plus(row.amount ?? 0), new Decimal(0));
  const paid = payments.reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  const carried = debts.reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  return {
    supplier,
    summary: {
      purchases: purchases.toFixed(2),
      debts: carried.toFixed(2),
      payments: paid.toFixed(2),
      balance: purchases.plus(carried).minus(paid).toFixed(2)
    },
    ledger
  };
}
