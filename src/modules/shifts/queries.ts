import {and, desc, eq, inArray} from 'drizzle-orm';
import Decimal from 'decimal.js';

import {db} from '@/db/client';
import {
  auditLogs,
  expenseCategories,
  expenses,
  medicines,
  saleItems,
  sales,
  shifts,
  stockReceipts,
  users
} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

export async function listVisibleShifts(actor: PermissionActor) {
  if (actor.role !== 'ADMIN' && !actor.permissions.includes('shifts.view.all')) {
    authorize(actor, 'shifts.view.own', actor.id);
    return db
      .select({shift: shifts, userName: users.name})
      .from(shifts)
      .innerJoin(users, eq(users.id, shifts.userId))
      .where(eq(shifts.userId, actor.id))
      .orderBy(desc(shifts.openedAt));
  }
  authorize(actor, 'shifts.view.all');
  return db
    .select({shift: shifts, userName: users.name})
    .from(shifts)
    .innerJoin(users, eq(users.id, shifts.userId))
    .orderBy(desc(shifts.openedAt));
}

export async function getShiftDetail(actor: PermissionActor, shiftId: number) {
  const [row] = await db
    .select({shift: shifts, userName: users.name})
    .from(shifts)
    .innerJoin(users, eq(users.id, shifts.userId))
    .where(eq(shifts.id, shiftId))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  authorize(actor, 'shifts.view.own', row.shift.userId);

  const [saleRows, expenseRows, receiptRows, auditRows] = await Promise.all([
    db
      .select({id: sales.id, total: sales.total, status: sales.status, createdAt: sales.createdAt})
      .from(sales)
      .where(eq(sales.shiftId, shiftId))
      .orderBy(desc(sales.createdAt), desc(sales.id)),
    db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        description: expenses.description,
        status: expenses.status,
        occurredAt: expenses.occurredAt,
        categoryName: expenseCategories.name
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(eq(expenses.shiftId, shiftId))
      .orderBy(desc(expenses.occurredAt), desc(expenses.id)),
    db
      .select({
        id: stockReceipts.id,
        quantity: stockReceipts.quantity,
        status: stockReceipts.status,
        occurredAt: stockReceipts.occurredAt,
        medicineName: medicines.name
      })
      .from(stockReceipts)
      .innerJoin(medicines, eq(stockReceipts.medicineId, medicines.id))
      .where(eq(stockReceipts.shiftId, shiftId))
      .orderBy(desc(stockReceipts.occurredAt), desc(stockReceipts.id)),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        reason: auditLogs.reason,
        createdAt: auditLogs.createdAt,
        actorName: users.name
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.actorId, users.id))
      .where(
        and(
          eq(auditLogs.entityType, 'shifts'),
          eq(auditLogs.entityId, shiftId),
          inArray(auditLogs.action, ['CORRECT', 'REOPEN'])
        )
      )
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
  ]);

  const itemRows = saleRows.length
    ? await db
        .select({saleId: saleItems.saleId, name: medicines.name, quantity: saleItems.quantity})
        .from(saleItems)
        .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
        .where(inArray(saleItems.saleId, saleRows.map(({id}) => id)))
        .orderBy(saleItems.id)
    : [];

  const salesTotal = saleRows
    .filter(({status}) => status === 'COMPLETED')
    .reduce((sum, {total}) => sum.plus(total), new Decimal(0));
  const expensesTotal = expenseRows
    .filter(({status}) => status === 'ACTIVE')
    .reduce((sum, {amount}) => sum.plus(amount), new Decimal(0));

  return {
    ...row,
    sales: saleRows.map((sale) => ({
      ...sale,
      items: itemRows.filter(({saleId}) => saleId === sale.id).map(({name, quantity}) => ({name, quantity}))
    })),
    expenses: expenseRows,
    receipts: receiptRows,
    corrections: auditRows,
    totals: {
      sales: salesTotal.toFixed(2),
      expenses: expensesTotal.toFixed(2),
      net: salesTotal.minus(expensesTotal).toFixed(2),
      salesCount: saleRows.filter(({status}) => status === 'COMPLETED').length,
      unitsReceived: receiptRows
        .filter(({status}) => status === 'ACTIVE')
        .reduce((sum, {quantity}) => sum + quantity, 0)
    }
  };
}
