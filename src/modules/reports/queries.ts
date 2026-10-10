import Decimal from 'decimal.js';
import {and, desc, eq, gte, lt, sql} from 'drizzle-orm';

import {db} from '@/db/client';
import {
  expenses,
  medicines,
  sales,
  shifts,
  stockMovements,
  users
} from '@/db/schema';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

export async function getReportData(
  actor: PermissionActor,
  range: {from: Date; to: Date}
) {
  authorize(actor, 'reports.view.own', actor.id);
  const all = actor.role === 'ADMIN' || actor.permissions.includes('reports.view.all');
  const saleRange = [gte(sales.createdAt, range.from), lt(sales.createdAt, range.to)];
  const expenseRange = [
    gte(expenses.occurredAt, range.from),
    lt(expenses.occurredAt, range.to)
  ];
  if (!all) {
    saleRange.push(eq(sales.operatorId, actor.id));
    expenseRange.push(eq(expenses.operatorId, actor.id));
  }
  const [saleTotalRow, expenseTotalRow, saleRows, expenseRows, stock, movements, employeeRows, shiftRows] =
    await Promise.all([
      db
        .select({total: sql<string>`coalesce(sum(${sales.total}), 0)`})
        .from(sales)
        .where(and(...saleRange, eq(sales.status, 'COMPLETED'))),
      db
        .select({total: sql<string>`coalesce(sum(${expenses.amount}), 0)`})
        .from(expenses)
        .where(and(...expenseRange, eq(expenses.status, 'ACTIVE'))),
      db.select().from(sales).where(and(...saleRange)).orderBy(desc(sales.createdAt), desc(sales.id)).limit(200),
      db.select().from(expenses).where(and(...expenseRange)).orderBy(desc(expenses.occurredAt), desc(expenses.id)).limit(200),
      all
        ? db.select().from(medicines).where(eq(medicines.isActive, true)).orderBy(medicines.name)
        : Promise.resolve([]),
      db
        .select()
        .from(stockMovements)
        .where(
          and(
            gte(stockMovements.createdAt, range.from),
            lt(stockMovements.createdAt, range.to),
            !all ? eq(stockMovements.actorId, actor.id) : undefined
          )
        )
        .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
        .limit(200),
      db
        .select({id: users.id, name: users.name, isActive: users.isActive})
        .from(users)
        .where(!all ? eq(users.id, actor.id) : undefined)
        .orderBy(users.name),
      db
        .select()
        .from(shifts)
        .where(
          and(
            gte(shifts.openedAt, range.from),
            lt(shifts.openedAt, range.to),
            !all ? eq(shifts.userId, actor.id) : undefined
          )
        )
        .orderBy(desc(shifts.openedAt), desc(shifts.id))
        .limit(200)
    ]);
  const salesTotal = new Decimal(saleTotalRow[0]?.total ?? 0).toFixed(2);
  const expensesTotal = new Decimal(expenseTotalRow[0]?.total ?? 0).toFixed(2);
  return {
    range,
    summary: {
      salesTotal,
      expensesTotal,
      netTotal: new Decimal(salesTotal).minus(expensesTotal).toFixed(2)
    },
    sales: saleRows,
    expenses: expenseRows,
    stock,
    stockUnits: stock.reduce((sum, medicine) => sum + medicine.currentStock, 0),
    movements,
    employees: employeeRows,
    shifts: shiftRows
  };
}
