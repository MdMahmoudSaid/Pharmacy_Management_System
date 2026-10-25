import Decimal from 'decimal.js';
import {sql} from 'drizzle-orm';

import type {Database, DbTransaction} from '@/db/client';

type Executor = Database | DbTransaction;
export type FinancialRange = {from: Date; to: Date};

const CASH_LEDGER_LOCK_ID = 820241025;
const fixed = (value: Decimal.Value) => new Decimal(value).toFixed(2);

export async function lockCashLedger(tx: DbTransaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(${CASH_LEDGER_LOCK_ID})`);
}

export async function getCashSnapshot(executor: Executor) {
  const result = await executor.execute<{
    capital_additions: string;
    owner_withdrawals: string;
    profit_withdrawals: string;
    capital_withdrawals: string;
    revenue: string;
    cost_of_goods: string;
    expenses: string;
    supplier_payments: string;
  }>(sql`
    select
      coalesce((select sum(amount) from capital_movements where status = 'ACTIVE' and type = 'ADDITION'), 0)::numeric(14,2)::text as capital_additions,
      coalesce((select sum(amount) from capital_movements where status = 'ACTIVE' and type = 'WITHDRAWAL'), 0)::numeric(14,2)::text as owner_withdrawals,
      coalesce((select sum(profit_portion) from capital_movements where status = 'ACTIVE' and type = 'WITHDRAWAL'), 0)::numeric(14,2)::text as profit_withdrawals,
      coalesce((select sum(capital_portion) from capital_movements where status = 'ACTIVE' and type = 'WITHDRAWAL'), 0)::numeric(14,2)::text as capital_withdrawals,
      coalesce((select sum(total) from sales where status = 'COMPLETED'), 0)::numeric(14,2)::text as revenue,
      coalesce((
        select sum(si.unit_cost * si.quantity)
        from sale_items si
        inner join sales s on s.id = si.sale_id
        where s.status = 'COMPLETED'
      ), 0)::numeric(14,2)::text as cost_of_goods,
      coalesce((select sum(amount) from expenses where status = 'ACTIVE'), 0)::numeric(14,2)::text as expenses,
      coalesce((select sum(amount) from supplier_payments where status = 'ACTIVE'), 0)::numeric(14,2)::text as supplier_payments
  `);
  const row = result.rows[0]!;
  const capitalAdditions = new Decimal(row.capital_additions);
  const ownerWithdrawals = new Decimal(row.owner_withdrawals);
  const profitWithdrawals = new Decimal(row.profit_withdrawals);
  const capitalWithdrawals = new Decimal(row.capital_withdrawals);
  const revenue = new Decimal(row.revenue);
  const costOfGoods = new Decimal(row.cost_of_goods);
  const expenses = new Decimal(row.expenses);
  const supplierPayments = new Decimal(row.supplier_payments);
  const grossProfit = revenue.minus(costOfGoods);
  const netProfit = grossProfit.minus(expenses);
  const capital = capitalAdditions.minus(capitalWithdrawals);
  const cash = capitalAdditions
    .plus(revenue)
    .minus(expenses)
    .minus(supplierPayments)
    .minus(ownerWithdrawals);
  // Profit is only withdrawable as far as real cash sits above the capital: the part of the profit
  // already spent on stock or paid to suppliers is not in the cash box, so it cannot be taken out of it.
  const unwithdrawnProfit = Decimal.max(netProfit.minus(profitWithdrawals), 0);
  const withdrawableProfit = Decimal.min(unwithdrawnProfit, Decimal.max(cash.minus(capital), 0));

  return {
    cash: fixed(cash),
    capital: fixed(capital),
    capitalAdditions: fixed(capitalAdditions),
    ownerWithdrawals: fixed(ownerWithdrawals),
    profitWithdrawals: fixed(profitWithdrawals),
    capitalWithdrawals: fixed(capitalWithdrawals),
    revenue: fixed(revenue),
    costOfGoods: fixed(costOfGoods),
    grossProfit: fixed(grossProfit),
    expenses: fixed(expenses),
    supplierPayments: fixed(supplierPayments),
    netProfit: fixed(netProfit),
    withdrawableProfit: fixed(withdrawableProfit)
  };
}

export async function getFinancialPerformance(
  executor: Executor,
  range?: FinancialRange
) {
  const saleRange = range
    ? sql`and s.created_at >= ${range.from} and s.created_at < ${range.to}`
    : sql``;
  const expenseRange = range
    ? sql`and occurred_at >= ${range.from} and occurred_at < ${range.to}`
    : sql``;
  const result = await executor.execute<{
    revenue: string;
    cost_of_goods: string;
    expenses: string;
  }>(sql`
    select
      coalesce((
        select sum(s.total)
        from sales s
        where s.status = 'COMPLETED' ${saleRange}
      ), 0)::numeric(14,2)::text as revenue,
      coalesce((
        select sum(si.unit_cost * si.quantity)
        from sale_items si
        inner join sales s on s.id = si.sale_id
        where s.status = 'COMPLETED' ${saleRange}
      ), 0)::numeric(14,2)::text as cost_of_goods,
      coalesce((
        select sum(amount)
        from expenses
        where status = 'ACTIVE' ${expenseRange}
      ), 0)::numeric(14,2)::text as expenses
  `);
  const row = result.rows[0]!;
  const revenue = new Decimal(row.revenue);
  const costOfGoods = new Decimal(row.cost_of_goods);
  const expenses = new Decimal(row.expenses);
  const grossProfit = revenue.minus(costOfGoods);

  return {
    revenue: fixed(revenue),
    costOfGoods: fixed(costOfGoods),
    grossProfit: fixed(grossProfit),
    expenses: fixed(expenses),
    netProfit: fixed(grossProfit.minus(expenses))
  };
}
