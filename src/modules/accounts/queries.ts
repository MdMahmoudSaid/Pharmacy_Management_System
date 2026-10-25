import Decimal from 'decimal.js';
import {and, desc, eq, gte, inArray, lt, sql} from 'drizzle-orm';

import {db} from '@/db/client';
import {
  capitalMovements,
  medicines,
  stockReceipts,
  supplierPayments,
  suppliers,
  users
} from '@/db/schema';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {getCashSnapshot, getFinancialPerformance, type FinancialRange} from './cash';

const fixed = (value: Decimal.Value) => new Decimal(value).toFixed(2);

export async function getAccountsOverview(actor: PermissionActor, range?: FinancialRange) {
  authorize(actor, 'accounts.view.all');
  const [cash, performance, inventoryRows, movements, supplierRows] =
    await Promise.all([
      getCashSnapshot(db),
      getFinancialPerformance(db, range),
      db.select({
        value: sql<string>`coalesce(sum(${medicines.averageCost} * ${medicines.currentStock}), 0)::text`
      }).from(medicines),
      db
        .select({movement: capitalMovements, operatorName: users.name})
        .from(capitalMovements)
        .innerJoin(users, eq(users.id, capitalMovements.operatorId))
        .where(and(
          eq(capitalMovements.status, 'ACTIVE'),
          range ? gte(capitalMovements.occurredAt, range.from) : undefined,
          range ? lt(capitalMovements.occurredAt, range.to) : undefined
        ))
        .orderBy(desc(capitalMovements.occurredAt), desc(capitalMovements.id))
        .limit(100),
      db.select({id: suppliers.id}).from(suppliers)
    ]);

  const supplierIds = supplierRows.map(({id}) => id);
  const [purchaseRows, paymentRows] = supplierIds.length
    ? await Promise.all([
        db
          .select({
            supplierId: stockReceipts.supplierId,
            amount: sql<string>`coalesce(sum(${stockReceipts.totalCost}), 0)::text`
          })
          .from(stockReceipts)
          .where(and(inArray(stockReceipts.supplierId, supplierIds), eq(stockReceipts.status, 'ACTIVE')))
          .groupBy(stockReceipts.supplierId),
        db
          .select({
            supplierId: supplierPayments.supplierId,
            amount: sql<string>`coalesce(sum(${supplierPayments.amount}), 0)::text`
          })
          .from(supplierPayments)
          .where(and(inArray(supplierPayments.supplierId, supplierIds), eq(supplierPayments.status, 'ACTIVE')))
          .groupBy(supplierPayments.supplierId)
      ])
    : [[], []];
  const purchases = new Map(purchaseRows.map((row) => [row.supplierId, row.amount]));
  const payments = new Map(paymentRows.map((row) => [row.supplierId, row.amount]));
  const supplierTotals = supplierIds.reduce(
    (totals, id) => {
      const balance = new Decimal(purchases.get(id) ?? 0).minus(payments.get(id) ?? 0);
      return {
        debt: totals.debt.plus(Decimal.max(balance, 0)),
        advances: totals.advances.plus(Decimal.max(balance.negated(), 0))
      };
    },
    {debt: new Decimal(0), advances: new Decimal(0)}
  );

  return {
    summary: {
      cash: cash.cash,
      capital: cash.capital,
      revenue: performance.revenue,
      costOfGoods: performance.costOfGoods,
      grossProfit: performance.grossProfit,
      expenses: performance.expenses,
      netProfit: performance.netProfit,
      withdrawableProfit: cash.withdrawableProfit,
      inventoryValue: fixed(inventoryRows[0]?.value ?? 0),
      supplierDebt: fixed(supplierTotals.debt),
      supplierAdvances: fixed(supplierTotals.advances)
    },
    movements: movements.map(({movement, operatorName}) => ({...movement, operatorName}))
  };
}
