import Decimal from 'decimal.js';
import {and, asc, desc, eq, gte, inArray, isNull, lt, lte, sql, type AnyColumn} from 'drizzle-orm';
import {getTranslations} from 'next-intl/server';

import {db} from '@/db/client';
import {
  auditLogs,
  capitalMovements,
  expenseCategories,
  expenses,
  medicines,
  saleItems,
  sales,
  shifts,
  stockMovements,
  stockReceipts,
  supplierPayments,
  suppliers,
  users
} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {findReport, type ReportSlug} from './catalog';
import type {ReportFilters} from './filters';

export type CellKind = 'text' | 'money' | 'number' | 'signed' | 'percent' | 'date' | 'datetime' | 'duration';
export type Tone = 'ok' | 'low' | 'out' | 'cancelled' | 'open' | 'muted';
export type Cell = {value: string | number | Date | null; tone?: Tone; href?: string};
export type Column = {key: string; label: string; kind: CellKind};
export type Metric = {label: string; value: string | number; kind: 'money' | 'number' | 'percent' | 'duration'};

export type ReportResult = {
  columns: Column[];
  rows: Cell[][];
  // One entry per column; null leaves the footer cell empty.
  totals: (Cell | null)[] | null;
  totalsLabel: string;
  primary: Metric;
  metrics: Metric[];
  truncated: boolean;
  dated: boolean;
};

type T = Awaited<ReturnType<typeof getTranslations<'Reports'>>>;
type Context = {actor: PermissionActor; filters: ReportFilters; t: T; locale: 'ar' | 'fr'; employeeId?: number};

const ROW_LIMIT = 1000;
// Correlated subqueries must name the outer table: drizzle prints a bare "id" in a select list,
// which Postgres would resolve to the inner sales or sale_items id instead.
const MEDICINE_ID = sql.raw('"medicines"."id"');
const SHIFT_ID = sql.raw('"shifts"."id"');
const zero = new Decimal(0);
const money = (value: Decimal.Value) => new Decimal(value).toFixed(2);
const share = (part: Decimal.Value, whole: Decimal.Value) =>
  new Decimal(whole).isZero() ? 0 : new Decimal(part).div(whole).times(100).toDecimalPlaces(1).toNumber();
const dayKey = (column: AnyColumn, month: boolean) =>
  // The format is inlined so the grouped expression matches the selected one exactly.
  sql<string>`to_char(${column} at time zone 'Africa/Nouakchott', ${sql.raw(month ? "'YYYY-MM'" : "'YYYY-MM-DD'")})`;
const inRange = (column: typeof sales.createdAt, {range}: ReportFilters) => [gte(column, range.from), lt(column, range.to)];
const cell = (value: Cell['value'], extra: Omit<Cell, 'value'> = {}): Cell => ({value, ...extra});
const col = (t: T, key: string, kind: CellKind): Column => ({key, label: t(`cols.${key}` as 'cols.date'), kind});
const metric = (t: T, key: string, value: Metric['value'], kind: Metric['kind']): Metric => ({
  label: t(`metrics.${key}` as 'metrics.revenue'),
  value,
  kind
});

function saleStatusCell(t: T, status: 'COMPLETED' | 'CANCELLED') {
  return cell(t(`statuses.${status}`), {tone: status === 'CANCELLED' ? 'cancelled' : 'ok'});
}

function stockTone(stock: number, min: number): Tone {
  if (stock === 0) return 'out';
  return stock <= min ? 'low' : 'ok';
}

async function financialSummary({filters, t, employeeId}: Context): Promise<ReportResult> {
  // Long periods read better month by month.
  const byMonth = filters.range.to.getTime() - filters.range.from.getTime() > 62 * 86_400_000;
  const saleDay = dayKey(sales.createdAt, byMonth);
  const expenseDay = dayKey(expenses.occurredAt, byMonth);
  const [saleRows, expenseRows, costRows] = await Promise.all([
    db
      .select({
        day: saleDay,
        count: sql<number>`count(*) filter (where ${sales.status} = 'COMPLETED')::int`,
        cancelled: sql<number>`count(*) filter (where ${sales.status} = 'CANCELLED')::int`,
        total: sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.status} = 'COMPLETED'), 0)`
      })
      .from(sales)
      .where(and(...inRange(sales.createdAt, filters), employeeId ? eq(sales.operatorId, employeeId) : undefined))
      .groupBy(saleDay),
    db
      .select({day: expenseDay, total: sql<string>`coalesce(sum(${expenses.amount}), 0)`})
      .from(expenses)
      .where(
        and(
          gte(expenses.occurredAt, filters.range.from),
          lt(expenses.occurredAt, filters.range.to),
          eq(expenses.status, 'ACTIVE'),
          employeeId ? eq(expenses.operatorId, employeeId) : undefined
        )
      )
      .groupBy(expenseDay),
    db
      .select({day: saleDay, total: sql<string>`coalesce(sum(${saleItems.unitCost} * ${saleItems.quantity}), 0)`})
      .from(saleItems)
      .innerJoin(sales, eq(saleItems.saleId, sales.id))
      .where(and(...inRange(sales.createdAt, filters), eq(sales.status, 'COMPLETED'), employeeId ? eq(sales.operatorId, employeeId) : undefined))
      .groupBy(saleDay)
  ]);
  const days = [...new Set([...saleRows.map(({day}) => day), ...expenseRows.map(({day}) => day)])].sort().reverse();
  let revenue = zero;
  let spent = zero;
  let cost = zero;
  let count = 0;
  let cancelled = 0;
  const rows = days.map((day) => {
    const sale = saleRows.find((row) => row.day === day);
    const expense = expenseRows.find((row) => row.day === day);
    const dayRevenue = new Decimal(sale?.total ?? 0);
    const daySpent = new Decimal(expense?.total ?? 0);
    const dayCost = new Decimal(costRows.find((row) => row.day === day)?.total ?? 0);
    revenue = revenue.plus(dayRevenue);
    spent = spent.plus(daySpent);
    cost = cost.plus(dayCost);
    count += sale?.count ?? 0;
    cancelled += sale?.cancelled ?? 0;
    const net = dayRevenue.minus(dayCost).minus(daySpent);
    return [
      cell(day),
      cell(sale?.count ?? 0),
      cell(sale?.cancelled ?? 0, sale?.cancelled ? {tone: 'cancelled'} : {}),
      cell(money(dayRevenue)),
      cell(money(dayCost)),
      cell(money(daySpent)),
      cell(money(net), net.isNegative() ? {tone: 'out'} : {})
    ];
  });
  const net = revenue.minus(cost).minus(spent);
  return {
    columns: [
      {...col(t, byMonth ? 'month' : 'day', 'text')},
      col(t, 'salesCount', 'number'),
      col(t, 'cancelledCount', 'number'),
      col(t, 'revenue', 'money'),
      col(t, 'costOfGoods', 'money'),
      col(t, 'expenses', 'money'),
      col(t, 'net', 'money')
    ],
    rows,
    totals: [null, cell(count), cell(cancelled), cell(money(revenue)), cell(money(cost)), cell(money(spent)), cell(money(net), net.isNegative() ? {tone: 'out'} : {})],
    totalsLabel: t('totals'),
    primary: metric(t, 'net', money(net), 'money'),
    metrics: [
      metric(t, 'revenue', money(revenue), 'money'),
      metric(t, 'costOfGoods', money(cost), 'money'),
      metric(t, 'expenses', money(spent), 'money'),
      metric(t, 'salesCount', count, 'number'),
      metric(t, 'averageBasket', money(count ? revenue.div(count) : 0), 'money')
    ],
    truncated: false,
    dated: true
  };
}

async function salesJournal({filters, t, locale, employeeId}: Context): Promise<ReportResult> {
  const rows = await db
    .select({id: sales.id, total: sales.total, status: sales.status, createdAt: sales.createdAt, operatorName: users.name})
    .from(sales)
    .innerJoin(users, eq(sales.operatorId, users.id))
    .where(
      and(
        ...inRange(sales.createdAt, filters),
        employeeId ? eq(sales.operatorId, employeeId) : undefined,
        filters.saleStatus ? eq(sales.status, filters.saleStatus) : undefined
      )
    )
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .limit(ROW_LIMIT + 1);
  const visible = rows.slice(0, ROW_LIMIT);
  const items = visible.length
    ? await db
        .select({saleId: saleItems.saleId, name: medicines.name, quantity: saleItems.quantity})
        .from(saleItems)
        .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
        .where(inArray(saleItems.saleId, visible.map(({id}) => id)))
        .orderBy(asc(saleItems.id))
    : [];
  const separator = locale === 'ar' ? '، ' : ', ';
  let revenue = zero;
  let completed = 0;
  let cancelled = 0;
  let units = 0;
  const body = visible.map((sale) => {
    const lines = items.filter(({saleId}) => saleId === sale.id);
    const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
    if (sale.status === 'COMPLETED') {
      revenue = revenue.plus(sale.total);
      completed += 1;
      units += quantity;
    } else {
      cancelled += 1;
    }
    const tone: Tone | undefined = sale.status === 'CANCELLED' ? 'cancelled' : undefined;
    return [
      cell(`#${sale.id}`, {href: `/sales/${sale.id}`}),
      cell(sale.createdAt),
      cell(sale.operatorName),
      cell(lines.map(({name, quantity: qty}) => (qty > 1 ? `${name} × ${qty}` : name)).join(separator)),
      cell(quantity),
      saleStatusCell(t, sale.status),
      cell(money(sale.total), tone ? {tone} : {})
    ];
  });
  return {
    columns: [
      col(t, 'reference', 'text'),
      col(t, 'dateTime', 'datetime'),
      col(t, 'employee', 'text'),
      col(t, 'medicines', 'text'),
      col(t, 'units', 'number'),
      col(t, 'status', 'text'),
      col(t, 'amount', 'money')
    ],
    rows: body,
    totals: [null, null, null, null, cell(units), null, cell(money(revenue))],
    totalsLabel: t('totalsCompleted'),
    primary: metric(t, 'revenue', money(revenue), 'money'),
    metrics: [
      metric(t, 'salesCount', completed, 'number'),
      metric(t, 'cancelledCount', cancelled, 'number'),
      metric(t, 'unitsSold', units, 'number'),
      metric(t, 'averageBasket', money(completed ? revenue.div(completed) : 0), 'money')
    ],
    truncated: rows.length > ROW_LIMIT,
    dated: true
  };
}

async function salesByMedicine({filters, t, employeeId}: Context): Promise<ReportResult> {
  const revenueSql = sql<string>`coalesce(sum(${saleItems.lineTotal}), 0)`;
  const rows = await db
    .select({
      name: medicines.name,
      code: medicines.code,
      quantity: sql<number>`sum(${saleItems.quantity})::int`,
      count: sql<number>`count(distinct ${sales.id})::int`,
      revenue: revenueSql
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
    .where(and(...inRange(sales.createdAt, filters), eq(sales.status, 'COMPLETED'), employeeId ? eq(sales.operatorId, employeeId) : undefined))
    .groupBy(medicines.id, medicines.name, medicines.code)
    .orderBy(desc(revenueSql), asc(medicines.name));
  const revenue = rows.reduce((sum, row) => sum.plus(row.revenue), zero);
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);
  return {
    columns: [
      col(t, 'rank', 'number'),
      col(t, 'medicine', 'text'),
      col(t, 'code', 'text'),
      col(t, 'unitsSold', 'number'),
      col(t, 'salesCount', 'number'),
      col(t, 'averagePrice', 'money'),
      col(t, 'revenue', 'money'),
      col(t, 'share', 'percent')
    ],
    rows: rows.map((row, index) => [
      cell(index + 1),
      cell(row.name),
      cell(row.code),
      cell(row.quantity),
      cell(row.count),
      cell(money(new Decimal(row.revenue).div(row.quantity || 1))),
      cell(money(row.revenue)),
      cell(share(row.revenue, revenue))
    ]),
    totals: [null, null, null, cell(units), null, null, cell(money(revenue)), cell(rows.length ? 100 : 0)],
    totalsLabel: t('totals'),
    primary: metric(t, 'revenue', money(revenue), 'money'),
    metrics: [
      metric(t, 'unitsSold', units, 'number'),
      metric(t, 'medicinesSold', rows.length, 'number'),
      metric(t, 'topShare', rows.length ? share(rows[0].revenue, revenue) : 0, 'percent')
    ],
    truncated: false,
    dated: true
  };
}

async function salesByEmployee({filters, t}: Context): Promise<ReportResult> {
  const revenueSql = sql<string>`coalesce(sum(${sales.total}) filter (where ${sales.status} = 'COMPLETED'), 0)`;
  const rows = await db
    .select({
      name: users.name,
      count: sql<number>`count(*) filter (where ${sales.status} = 'COMPLETED')::int`,
      cancelled: sql<number>`count(*) filter (where ${sales.status} = 'CANCELLED')::int`,
      revenue: revenueSql
    })
    .from(sales)
    .innerJoin(users, eq(sales.operatorId, users.id))
    .where(and(...inRange(sales.createdAt, filters)))
    .groupBy(users.id, users.name)
    .orderBy(desc(revenueSql));
  const revenue = rows.reduce((sum, row) => sum.plus(row.revenue), zero);
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const cancelled = rows.reduce((sum, row) => sum + row.cancelled, 0);
  return {
    columns: [
      col(t, 'employee', 'text'),
      col(t, 'salesCount', 'number'),
      col(t, 'cancelledCount', 'number'),
      col(t, 'averageBasket', 'money'),
      col(t, 'revenue', 'money'),
      col(t, 'share', 'percent')
    ],
    rows: rows.map((row) => [
      cell(row.name),
      cell(row.count),
      cell(row.cancelled, row.cancelled ? {tone: 'cancelled'} : {}),
      cell(money(row.count ? new Decimal(row.revenue).div(row.count) : 0)),
      cell(money(row.revenue)),
      cell(share(row.revenue, revenue))
    ]),
    totals: [null, cell(count), cell(cancelled), cell(money(count ? revenue.div(count) : 0)), cell(money(revenue)), cell(rows.length ? 100 : 0)],
    totalsLabel: t('totals'),
    primary: metric(t, 'revenue', money(revenue), 'money'),
    metrics: [
      metric(t, 'salesCount', count, 'number'),
      metric(t, 'activeEmployees', rows.length, 'number'),
      metric(t, 'averageBasket', money(count ? revenue.div(count) : 0), 'money')
    ],
    truncated: false,
    dated: true
  };
}

async function expensesJournal({filters, t, employeeId}: Context): Promise<ReportResult> {
  const rows = await db
    .select({
      amount: expenses.amount,
      description: expenses.description,
      status: expenses.status,
      occurredAt: expenses.occurredAt,
      categoryName: expenseCategories.name,
      operatorName: users.name
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.operatorId, users.id))
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(
      and(
        gte(expenses.occurredAt, filters.range.from),
        lt(expenses.occurredAt, filters.range.to),
        employeeId ? eq(expenses.operatorId, employeeId) : undefined,
        filters.categoryId === 'none'
          ? isNull(expenses.categoryId)
          : filters.categoryId
            ? eq(expenses.categoryId, filters.categoryId)
            : undefined
      )
    )
    .orderBy(desc(expenses.occurredAt), desc(expenses.id))
    .limit(ROW_LIMIT + 1);
  const visible = rows.slice(0, ROW_LIMIT);
  const active = visible.filter(({status}) => status === 'ACTIVE');
  const total = active.reduce((sum, row) => sum.plus(row.amount), zero);
  return {
    columns: [
      col(t, 'dateTime', 'datetime'),
      col(t, 'category', 'text'),
      col(t, 'description', 'text'),
      col(t, 'employee', 'text'),
      col(t, 'status', 'text'),
      col(t, 'amount', 'money')
    ],
    rows: visible.map((row) => [
      cell(row.occurredAt),
      cell(row.categoryName ?? t('uncategorized'), row.categoryName ? {} : {tone: 'muted'}),
      cell(row.description),
      cell(row.operatorName),
      cell(t(`statuses.${row.status}`), {tone: row.status === 'CANCELLED' ? 'cancelled' : 'ok'}),
      cell(money(row.amount), row.status === 'CANCELLED' ? {tone: 'cancelled'} : {})
    ]),
    totals: [null, null, null, null, null, cell(money(total))],
    totalsLabel: t('totalsActive'),
    primary: metric(t, 'expenses', money(total), 'money'),
    metrics: [
      metric(t, 'expensesCount', active.length, 'number'),
      metric(t, 'averageExpense', money(active.length ? total.div(active.length) : 0), 'money'),
      metric(t, 'cancelledCount', visible.length - active.length, 'number')
    ],
    truncated: rows.length > ROW_LIMIT,
    dated: true
  };
}

async function stockValuation({filters, t}: Context): Promise<ReportResult> {
  const rows = await db
    .select({name: medicines.name, code: medicines.code, stock: medicines.currentStock, min: medicines.minStock, price: medicines.sellingPrice})
    .from(medicines)
    .where(eq(medicines.isActive, true))
    .orderBy(asc(medicines.name));
  const all = rows.map((row) => ({...row, tone: stockTone(row.stock, row.min), value: new Decimal(row.price).times(row.stock)}));
  const visible = filters.stockLevel
    ? all.filter(({tone}) => (filters.stockLevel === 'available' ? tone === 'ok' : tone === filters.stockLevel))
    : all;
  const value = visible.reduce((sum, row) => sum.plus(row.value), zero);
  const units = visible.reduce((sum, row) => sum + row.stock, 0);
  return {
    columns: [
      col(t, 'medicine', 'text'),
      col(t, 'code', 'text'),
      col(t, 'stock', 'number'),
      col(t, 'minStock', 'number'),
      col(t, 'sellingPrice', 'money'),
      col(t, 'stockValue', 'money'),
      col(t, 'state', 'text')
    ],
    rows: visible.map((row) => [
      cell(row.name),
      cell(row.code),
      cell(row.stock, row.tone === 'ok' ? {} : {tone: row.tone}),
      cell(row.min),
      cell(money(row.price)),
      cell(money(row.value)),
      cell(t(`levels.${row.tone}` as 'levels.ok'), {tone: row.tone})
    ]),
    totals: [null, null, cell(units), null, null, cell(money(value)), null],
    totalsLabel: t('totals'),
    primary: metric(t, 'stockValue', money(value), 'money'),
    metrics: [
      metric(t, 'units', units, 'number'),
      metric(t, 'medicines', visible.length, 'number'),
      metric(t, 'outOfStock', visible.filter(({tone}) => tone === 'out').length, 'number'),
      metric(t, 'lowStock', visible.filter(({tone}) => tone === 'low').length, 'number')
    ],
    truncated: false,
    dated: false
  };
}

async function stockAlerts({t}: Context): Promise<ReportResult> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db
    .select({
      name: medicines.name,
      code: medicines.code,
      stock: medicines.currentStock,
      min: medicines.minStock,
      sold30: sql<number>`coalesce((select sum(si.quantity) from sale_items si join sales s on s.id = si.sale_id where si.medicine_id = ${MEDICINE_ID} and s.status = 'COMPLETED' and s.created_at >= ${since}), 0)::int`,
      lastSale: sql<string | null>`(select to_char(max(s.created_at) at time zone 'Africa/Nouakchott', 'YYYY-MM-DD') from sale_items si join sales s on s.id = si.sale_id where si.medicine_id = ${MEDICINE_ID} and s.status = 'COMPLETED')`
    })
    .from(medicines)
    .where(and(eq(medicines.isActive, true), lte(medicines.currentStock, medicines.minStock)))
    .orderBy(asc(medicines.currentStock), asc(medicines.name));
  const out = rows.filter(({stock}) => stock === 0).length;
  return {
    columns: [
      col(t, 'medicine', 'text'),
      col(t, 'code', 'text'),
      col(t, 'stock', 'number'),
      col(t, 'minStock', 'number'),
      col(t, 'sold30', 'number'),
      col(t, 'lastSale', 'date'),
      col(t, 'state', 'text')
    ],
    rows: rows.map((row) => {
      const tone = stockTone(row.stock, row.min);
      return [
        cell(row.name),
        cell(row.code),
        cell(row.stock, {tone}),
        cell(row.min),
        cell(row.sold30),
        cell(row.lastSale),
        cell(t(`levels.${tone}` as 'levels.ok'), {tone})
      ];
    }),
    totals: null,
    totalsLabel: t('totals'),
    primary: metric(t, 'alerts', rows.length, 'number'),
    metrics: [metric(t, 'outOfStock', out, 'number'), metric(t, 'lowStock', rows.length - out, 'number')],
    truncated: false,
    dated: false
  };
}

async function stockReceiptsReport({filters, t, employeeId}: Context): Promise<ReportResult> {
  const rows = await db
    .select({
      occurredAt: stockReceipts.occurredAt,
      quantity: stockReceipts.quantity,
      status: stockReceipts.status,
      note: stockReceipts.note,
      medicineId: stockReceipts.medicineId,
      medicineName: medicines.name,
      operatorName: users.name
    })
    .from(stockReceipts)
    .innerJoin(medicines, eq(stockReceipts.medicineId, medicines.id))
    .innerJoin(users, eq(stockReceipts.operatorId, users.id))
    .where(
      and(
        gte(stockReceipts.occurredAt, filters.range.from),
        lt(stockReceipts.occurredAt, filters.range.to),
        employeeId ? eq(stockReceipts.operatorId, employeeId) : undefined
      )
    )
    .orderBy(desc(stockReceipts.occurredAt), desc(stockReceipts.id))
    .limit(ROW_LIMIT + 1);
  const visible = rows.slice(0, ROW_LIMIT);
  const active = visible.filter(({status}) => status === 'ACTIVE');
  const units = active.reduce((sum, row) => sum + row.quantity, 0);
  return {
    columns: [
      col(t, 'dateTime', 'datetime'),
      col(t, 'medicine', 'text'),
      col(t, 'employee', 'text'),
      col(t, 'note', 'text'),
      col(t, 'status', 'text'),
      col(t, 'quantity', 'number')
    ],
    rows: visible.map((row) => [
      cell(row.occurredAt),
      cell(row.medicineName),
      cell(row.operatorName),
      cell(row.note),
      cell(t(`statuses.${row.status}`), {tone: row.status === 'CANCELLED' ? 'cancelled' : 'ok'}),
      cell(row.quantity, row.status === 'CANCELLED' ? {tone: 'cancelled'} : {})
    ]),
    totals: [null, null, null, null, null, cell(units)],
    totalsLabel: t('totalsActive'),
    primary: metric(t, 'unitsReceived', units, 'number'),
    metrics: [
      metric(t, 'receipts', active.length, 'number'),
      metric(t, 'medicines', new Set(active.map(({medicineId}) => medicineId)).size, 'number')
    ],
    truncated: rows.length > ROW_LIMIT,
    dated: true
  };
}

async function stockMovementsReport({filters, t, employeeId}: Context): Promise<ReportResult> {
  const type = stockMovements.type.enumValues.find((value) => value === filters.movementType);
  const rows = await db
    .select({
      createdAt: stockMovements.createdAt,
      type: stockMovements.type,
      before: stockMovements.quantityBefore,
      change: stockMovements.quantityChange,
      after: stockMovements.quantityAfter,
      medicineName: medicines.name,
      actorName: users.name
    })
    .from(stockMovements)
    .innerJoin(medicines, eq(stockMovements.medicineId, medicines.id))
    .innerJoin(users, eq(stockMovements.actorId, users.id))
    .where(
      and(
        gte(stockMovements.createdAt, filters.range.from),
        lt(stockMovements.createdAt, filters.range.to),
        employeeId ? eq(stockMovements.actorId, employeeId) : undefined,
        type ? eq(stockMovements.type, type) : undefined
      )
    )
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(ROW_LIMIT + 1);
  const visible = rows.slice(0, ROW_LIMIT);
  const incoming = visible.reduce((sum, row) => sum + Math.max(row.change, 0), 0);
  const outgoing = visible.reduce((sum, row) => sum + Math.min(row.change, 0), 0);
  return {
    columns: [
      col(t, 'dateTime', 'datetime'),
      col(t, 'medicine', 'text'),
      col(t, 'movementType', 'text'),
      col(t, 'employee', 'text'),
      col(t, 'before', 'number'),
      col(t, 'change', 'signed'),
      col(t, 'after', 'number')
    ],
    rows: visible.map((row) => [
      cell(row.createdAt),
      cell(row.medicineName),
      cell(t(`movementTypes.${row.type}`)),
      cell(row.actorName),
      cell(row.before),
      cell(row.change, {tone: row.change < 0 ? 'out' : 'ok'}),
      cell(row.after)
    ]),
    totals: null,
    totalsLabel: t('totals'),
    primary: metric(t, 'movements', visible.length, 'number'),
    metrics: [metric(t, 'unitsIn', incoming, 'number'), metric(t, 'unitsOut', Math.abs(outgoing), 'number')],
    truncated: rows.length > ROW_LIMIT,
    dated: true
  };
}

async function dormantStock({filters, t}: Context): Promise<ReportResult> {
  const rows = await db
    .select({
      name: medicines.name,
      code: medicines.code,
      stock: medicines.currentStock,
      price: medicines.sellingPrice,
      lastSale: sql<string | null>`(select to_char(max(s.created_at) at time zone 'Africa/Nouakchott', 'YYYY-MM-DD') from sale_items si join sales s on s.id = si.sale_id where si.medicine_id = ${MEDICINE_ID} and s.status = 'COMPLETED')`
    })
    .from(medicines)
    .where(
      and(
        eq(medicines.isActive, true),
        sql`${medicines.currentStock} > 0`,
        sql`not exists (select 1 from sale_items si join sales s on s.id = si.sale_id where si.medicine_id = ${MEDICINE_ID} and s.status = 'COMPLETED' and s.created_at >= ${filters.range.from} and s.created_at < ${filters.range.to})`
      )
    );
  const withValue = rows
    .map((row) => ({...row, value: new Decimal(row.price).times(row.stock)}))
    .sort((left, right) => right.value.comparedTo(left.value));
  const value = withValue.reduce((sum, row) => sum.plus(row.value), zero);
  const units = withValue.reduce((sum, row) => sum + row.stock, 0);
  return {
    columns: [
      col(t, 'medicine', 'text'),
      col(t, 'code', 'text'),
      col(t, 'stock', 'number'),
      col(t, 'sellingPrice', 'money'),
      col(t, 'lastSale', 'date'),
      col(t, 'stockValue', 'money')
    ],
    rows: withValue.map((row) => [
      cell(row.name),
      cell(row.code),
      cell(row.stock),
      cell(money(row.price)),
      row.lastSale ? cell(row.lastSale) : cell(t('never'), {tone: 'muted'}),
      cell(money(row.value))
    ]),
    totals: [null, null, cell(units), null, null, cell(money(value))],
    totalsLabel: t('totals'),
    primary: metric(t, 'idleValue', money(value), 'money'),
    metrics: [metric(t, 'medicines', withValue.length, 'number'), metric(t, 'units', units, 'number')],
    truncated: false,
    dated: true
  };
}

async function shiftsReport({filters, t, employeeId}: Context): Promise<ReportResult> {
  const rows = await db
    .select({
      id: shifts.id,
      openedAt: shifts.openedAt,
      closedAt: shifts.closedAt,
      status: shifts.status,
      userName: users.name,
      count: sql<number>`(select count(*) from sales s where s.shift_id = ${SHIFT_ID} and s.status = 'COMPLETED')::int`,
      revenue: sql<string>`(select coalesce(sum(s.total), 0) from sales s where s.shift_id = ${SHIFT_ID} and s.status = 'COMPLETED')`,
      spent: sql<string>`(select coalesce(sum(e.amount), 0) from expenses e where e.shift_id = ${SHIFT_ID} and e.status = 'ACTIVE')`
    })
    .from(shifts)
    .innerJoin(users, eq(shifts.userId, users.id))
    .where(and(gte(shifts.openedAt, filters.range.from), lt(shifts.openedAt, filters.range.to), employeeId ? eq(shifts.userId, employeeId) : undefined))
    .orderBy(desc(shifts.openedAt), desc(shifts.id))
    .limit(ROW_LIMIT + 1);
  const visible = rows.slice(0, ROW_LIMIT);
  const now = Date.now();
  let revenue = zero;
  let spent = zero;
  let minutes = 0;
  let count = 0;
  const body = visible.map((row) => {
    const duration = Math.max(0, Math.round(((row.closedAt?.getTime() ?? now) - row.openedAt.getTime()) / 60_000));
    const net = new Decimal(row.revenue).minus(row.spent);
    revenue = revenue.plus(row.revenue);
    spent = spent.plus(row.spent);
    minutes += duration;
    count += row.count;
    return [
      cell(row.userName, {href: `/shifts/${row.id}`}),
      cell(row.openedAt),
      cell(row.closedAt, row.closedAt ? {} : {tone: 'open'}),
      cell(duration),
      cell(row.count),
      cell(money(row.revenue)),
      cell(money(row.spent)),
      cell(money(net), net.isNegative() ? {tone: 'out'} : {})
    ];
  });
  return {
    columns: [
      col(t, 'employee', 'text'),
      col(t, 'opened', 'datetime'),
      col(t, 'closed', 'datetime'),
      col(t, 'duration', 'duration'),
      col(t, 'salesCount', 'number'),
      col(t, 'revenue', 'money'),
      col(t, 'expenses', 'money'),
      col(t, 'expectedCash', 'money')
    ],
    rows: body,
    totals: [null, null, null, cell(minutes), cell(count), cell(money(revenue)), cell(money(spent)), cell(money(revenue.minus(spent)))],
    totalsLabel: t('totals'),
    primary: metric(t, 'expectedCash', money(revenue.minus(spent)), 'money'),
    metrics: [
      metric(t, 'shifts', visible.length, 'number'),
      metric(t, 'hoursWorked', minutes, 'duration'),
      metric(t, 'revenue', money(revenue), 'money')
    ],
    truncated: rows.length > ROW_LIMIT,
    dated: true
  };
}

async function cancellations({filters, t, locale, employeeId}: Context): Promise<ReportResult> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      reason: auditLogs.reason,
      createdAt: auditLogs.createdAt,
      actorName: users.name
    })
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(
      and(
        gte(auditLogs.createdAt, filters.range.from),
        lt(auditLogs.createdAt, filters.range.to),
        inArray(auditLogs.action, ['CANCEL', 'CORRECT', 'REOPEN']),
        inArray(auditLogs.entityType, ['sales', 'expenses', 'stock_receipts', 'shifts']),
        employeeId ? eq(auditLogs.actorId, employeeId) : undefined
      )
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(ROW_LIMIT + 1);
  const visible = rows.slice(0, ROW_LIMIT);
  const ids = (type: string) => [...new Set(visible.filter(({entityType}) => entityType === type).map(({entityId}) => entityId))];
  const [saleRows, saleLines, expenseRows, receiptRows, shiftRows] = await Promise.all([
    ids('sales').length ? db.select({id: sales.id, total: sales.total}).from(sales).where(inArray(sales.id, ids('sales'))) : [],
    ids('sales').length
      ? db
          .select({saleId: saleItems.saleId, name: medicines.name, quantity: saleItems.quantity})
          .from(saleItems)
          .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
          .where(inArray(saleItems.saleId, ids('sales')))
      : [],
    ids('expenses').length
      ? db
          .select({id: expenses.id, amount: expenses.amount, description: expenses.description, categoryName: expenseCategories.name})
          .from(expenses)
          .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
          .where(inArray(expenses.id, ids('expenses')))
      : [],
    ids('stock_receipts').length
      ? db
          .select({id: stockReceipts.id, quantity: stockReceipts.quantity, name: medicines.name})
          .from(stockReceipts)
          .innerJoin(medicines, eq(stockReceipts.medicineId, medicines.id))
          .where(inArray(stockReceipts.id, ids('stock_receipts')))
      : [],
    ids('shifts').length
      ? db.select({id: shifts.id, name: users.name}).from(shifts).innerJoin(users, eq(shifts.userId, users.id)).where(inArray(shifts.id, ids('shifts')))
      : []
  ]);
  const separator = locale === 'ar' ? '، ' : ', ';
  let cancelledAmount = zero;
  let cancelCount = 0;
  const body = visible.map((row) => {
    let subject = '';
    let amount: string | null = null;
    let href: string | undefined;
    if (row.entityType === 'sales') {
      const sale = saleRows.find(({id}) => id === row.entityId);
      subject = `#${row.entityId} · ${saleLines.filter(({saleId}) => saleId === row.entityId).map(({name, quantity}) => (quantity > 1 ? `${name} × ${quantity}` : name)).join(separator)}`;
      amount = sale ? money(sale.total) : null;
      href = `/sales/${row.entityId}`;
    } else if (row.entityType === 'expenses') {
      const expense = expenseRows.find(({id}) => id === row.entityId);
      subject = [expense?.categoryName, expense?.description].filter(Boolean).join(' · ');
      amount = expense ? money(expense.amount) : null;
    } else if (row.entityType === 'stock_receipts') {
      const receipt = receiptRows.find(({id}) => id === row.entityId);
      subject = receipt ? `${receipt.name} × ${receipt.quantity}` : '';
    } else {
      subject = shiftRows.find(({id}) => id === row.entityId)?.name ?? '';
      href = `/shifts/${row.entityId}`;
    }
    if (row.action === 'CANCEL') {
      cancelCount += 1;
      if (amount) cancelledAmount = cancelledAmount.plus(amount);
    }
    const tone: Tone = row.action === 'CANCEL' ? 'out' : row.action === 'REOPEN' ? 'open' : 'low';
    return [
      cell(row.createdAt),
      cell(t(`operations.${row.entityType}.${row.action}` as 'operations.sales.CANCEL'), {tone}),
      cell(subject, href ? {href} : {}),
      cell(row.actorName),
      cell(row.reason, row.reason ? {} : {tone: 'muted'}),
      cell(amount)
    ];
  });
  return {
    columns: [
      col(t, 'dateTime', 'datetime'),
      col(t, 'operation', 'text'),
      col(t, 'subject', 'text'),
      col(t, 'by', 'text'),
      col(t, 'reason', 'text'),
      col(t, 'amount', 'money')
    ],
    rows: body,
    totals: null,
    totalsLabel: t('totals'),
    primary: metric(t, 'cancelledAmount', money(cancelledAmount), 'money'),
    metrics: [
      metric(t, 'cancellations', cancelCount, 'number'),
      metric(t, 'corrections', visible.length - cancelCount, 'number')
    ],
    truncated: rows.length > ROW_LIMIT,
    dated: true
  };
}

async function cashFlow({filters, t}: Context): Promise<ReportResult> {
  const [saleRows, expenseRows, paymentRows, capitalRows] = await Promise.all([
    db.select({id: sales.id, at: sales.createdAt, amount: sales.total}).from(sales)
      .where(and(lt(sales.createdAt, filters.range.to), eq(sales.status, 'COMPLETED'))),
    db.select({id: expenses.id, at: expenses.occurredAt, amount: expenses.amount}).from(expenses)
      .where(and(lt(expenses.occurredAt, filters.range.to), eq(expenses.status, 'ACTIVE'))),
    db.select({id: supplierPayments.id, at: supplierPayments.occurredAt, amount: supplierPayments.amount}).from(supplierPayments)
      .where(and(lt(supplierPayments.occurredAt, filters.range.to), eq(supplierPayments.status, 'ACTIVE'))),
    db.select({id: capitalMovements.id, at: capitalMovements.occurredAt, amount: capitalMovements.amount, type: capitalMovements.type}).from(capitalMovements)
      .where(and(lt(capitalMovements.occurredAt, filters.range.to), eq(capitalMovements.status, 'ACTIVE')))
  ]);
  const events = [
    ...saleRows.map((row) => ({...row, kind: 'sale' as const, incoming: true})),
    ...expenseRows.map((row) => ({...row, kind: 'expense' as const, incoming: false})),
    ...paymentRows.map((row) => ({...row, kind: 'supplierPayment' as const, incoming: false})),
    ...capitalRows.map((row) => ({...row, kind: row.type === 'ADDITION' ? 'capitalAddition' as const : 'ownerWithdrawal' as const, incoming: row.type === 'ADDITION'}))
  ].sort((left, right) => left.at.getTime() - right.at.getTime() || left.id - right.id);
  let running = events.filter(({at}) => at < filters.range.from).reduce(
    (sum, event) => event.incoming ? sum.plus(event.amount) : sum.minus(event.amount),
    zero
  );
  let incoming = zero;
  let outgoing = zero;
  const body = events.filter(({at}) => at >= filters.range.from).map((event) => {
    const amount = new Decimal(event.amount);
    running = event.incoming ? running.plus(amount) : running.minus(amount);
    if (event.incoming) incoming = incoming.plus(amount); else outgoing = outgoing.plus(amount);
    return [
      cell(event.at),
      cell(t(`cashTypes.${event.kind}` as 'cashTypes.sale')),
      cell(`#${event.id}`),
      cell(event.incoming ? money(amount) : null),
      cell(event.incoming ? null : money(amount)),
      cell(money(running), running.isNegative() ? {tone: 'out'} : {})
    ];
  }).reverse();
  return {
    columns: [col(t, 'dateTime', 'datetime'), col(t, 'operation', 'text'), col(t, 'reference', 'text'), col(t, 'cashIn', 'money'), col(t, 'cashOut', 'money'), col(t, 'cashBalance', 'money')],
    rows: body,
    totals: [null, null, null, cell(money(incoming)), cell(money(outgoing)), cell(money(running))],
    totalsLabel: t('totals'),
    primary: metric(t, 'cashBalance', money(running), 'money'),
    metrics: [metric(t, 'cashIn', money(incoming), 'money'), metric(t, 'cashOut', money(outgoing), 'money'), metric(t, 'cashNet', money(incoming.minus(outgoing)), 'money')],
    truncated: false,
    dated: true
  };
}

async function supplierBalances({t}: Context): Promise<ReportResult> {
  const rows = await db.select({
    id: suppliers.id,
    name: suppliers.name,
    phone: suppliers.phone,
    purchases: sql<string>`coalesce((select sum(${stockReceipts.totalCost}) from ${stockReceipts} where ${stockReceipts.supplierId} = ${suppliers.id} and ${stockReceipts.status} = 'ACTIVE'), 0)::numeric(14,2)::text`,
    payments: sql<string>`coalesce((select sum(${supplierPayments.amount}) from ${supplierPayments} where ${supplierPayments.supplierId} = ${suppliers.id} and ${supplierPayments.status} = 'ACTIVE'), 0)::numeric(14,2)::text`
  }).from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name));
  let purchases = zero;
  let payments = zero;
  let debt = zero;
  let advances = zero;
  const body = rows.map((row) => {
    const balance = new Decimal(row.purchases).minus(row.payments);
    purchases = purchases.plus(row.purchases);
    payments = payments.plus(row.payments);
    debt = debt.plus(Decimal.max(balance, 0));
    advances = advances.plus(Decimal.max(balance.negated(), 0));
    return [cell(row.name, {href: `/suppliers/${row.id}`}), cell(row.phone), cell(row.purchases), cell(row.payments), cell(money(balance), balance.isPositive() ? {tone: 'out'} : balance.isNegative() ? {tone: 'ok'} : {})];
  });
  return {
    columns: [col(t, 'supplier', 'text'), col(t, 'phone', 'text'), col(t, 'purchases', 'money'), col(t, 'payments', 'money'), col(t, 'balance', 'money')],
    rows: body,
    totals: [null, null, cell(money(purchases)), cell(money(payments)), cell(money(purchases.minus(payments)))],
    totalsLabel: t('totals'),
    primary: metric(t, 'supplierDebt', money(debt), 'money'),
    metrics: [metric(t, 'supplierAdvances', money(advances), 'money'), metric(t, 'suppliers', rows.length, 'number'), metric(t, 'purchases', money(purchases), 'money')],
    truncated: false,
    dated: false
  };
}

const BUILDERS: Record<ReportSlug, (context: Context) => Promise<ReportResult>> = {
  'financial-summary': financialSummary,
  'sales-journal': salesJournal,
  'sales-by-medicine': salesByMedicine,
  'sales-by-employee': salesByEmployee,
  'expenses-journal': expensesJournal,
  'cash-flow': cashFlow,
  'supplier-balances': supplierBalances,
  'stock-valuation': stockValuation,
  'stock-alerts': stockAlerts,
  'stock-receipts': stockReceiptsReport,
  'stock-movements': stockMovementsReport,
  'dormant-stock': dormantStock,
  shifts: shiftsReport,
  cancellations
};

export const seesAllReports = (actor: PermissionActor) =>
  actor.role === 'ADMIN' || actor.permissions.includes('reports.view.all');

export function canOpenReport(actor: PermissionActor, slug: string) {
  const report = findReport(slug);
  if (!report || !actor.isActive) return false;
  if (seesAllReports(actor)) return true;
  return report.scope === 'own' && actor.permissions.includes('reports.view.own');
}

export async function buildReport(actor: PermissionActor, slug: string, filters: ReportFilters, locale: 'ar' | 'fr') {
  const report = findReport(slug);
  if (!report) throw new AppError('NOT_FOUND');
  authorize(actor, 'reports.view.own', actor.id);
  if (!canOpenReport(actor, slug)) throw new AppError('FORBIDDEN');
  const t = await getTranslations({locale, namespace: 'Reports'});
  // Employees limited to their own reports always see only their own activity.
  const employeeId = seesAllReports(actor) ? filters.employeeId : actor.id;
  return BUILDERS[report.slug as ReportSlug]({actor, filters, t, locale, employeeId});
}

export async function reportFilterOptions(actor: PermissionActor) {
  const all = seesAllReports(actor);
  const [employees, categories] = await Promise.all([
    all ? db.select({id: users.id, name: users.name}).from(users).orderBy(asc(users.name)) : [],
    db
      .select({id: expenseCategories.id, name: expenseCategories.name})
      .from(expenseCategories)
      .where(eq(expenseCategories.isActive, true))
      .orderBy(asc(expenseCategories.name))
  ]);
  return {employees, categories, movementTypes: stockMovements.type.enumValues};
}
