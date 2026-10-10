import {and, desc, eq, gte, inArray, lt} from 'drizzle-orm';

import {db} from '@/db/client';
import {
  auditLogs,
  expenseCategories,
  expenses,
  medicines,
  saleItems,
  shifts,
  stockReceipts,
  users
} from '@/db/schema';
import {referencedIds} from './format';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

export async function listAuditLogs(
  actor: PermissionActor,
  filters: {from?: Date; to?: Date; action?: string; entityType?: string} = {}
) {
  authorize(actor, 'audit.view.all');
  return db
    .select({audit: auditLogs, actorName: users.name})
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(
      and(
        filters.from ? gte(auditLogs.createdAt, filters.from) : undefined,
        filters.to ? lt(auditLogs.createdAt, filters.to) : undefined,
        filters.action ? eq(auditLogs.action, filters.action as typeof auditLogs.action.enumValues[number]) : undefined,
        filters.entityType ? eq(auditLogs.entityType, filters.entityType) : undefined
      )
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(300);
}

export async function auditReferenceNames(rows: Awaited<ReturnType<typeof listAuditLogs>>) {
  const {medicineIds, userIds, categoryIds} = referencedIds(
    rows.flatMap(({audit}) => [audit.oldValues, audit.newValues])
  );
  for (const {audit} of rows) {
    if (audit.entityType === 'medicines') medicineIds.push(audit.entityId);
    if (audit.entityType === 'users') userIds.push(audit.entityId);
    if (audit.entityType === 'expense_categories') categoryIds.push(audit.entityId);
  }
  const [medicineRows, userRows, categoryRows] = await Promise.all([
    medicineIds.length
      ? db.select({id: medicines.id, name: medicines.name}).from(medicines).where(inArray(medicines.id, medicineIds))
      : [],
    userIds.length
      ? db.select({id: users.id, name: users.name}).from(users).where(inArray(users.id, userIds))
      : [],
    categoryIds.length
      ? db
          .select({id: expenseCategories.id, name: expenseCategories.name})
          .from(expenseCategories)
          .where(inArray(expenseCategories.id, categoryIds))
      : []
  ]);
  const idsOf = (type: string) => rows.filter(({audit}) => audit.entityType === type).map(({audit}) => audit.entityId);
  const [expenseRows, saleRows, receiptRows, shiftRows] = await Promise.all([
    idsOf('expenses').length
      ? db
          .select({id: expenses.id, category: expenseCategories.name, description: expenses.description})
          .from(expenses)
          .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
          .where(inArray(expenses.id, idsOf('expenses')))
      : [],
    idsOf('sales').length
      ? db
          .select({id: saleItems.saleId, medicine: medicines.name})
          .from(saleItems)
          .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
          .where(inArray(saleItems.saleId, idsOf('sales')))
      : [],
    idsOf('stock_receipts').length
      ? db
          .select({id: stockReceipts.id, medicine: medicines.name, quantity: stockReceipts.quantity})
          .from(stockReceipts)
          .innerJoin(medicines, eq(stockReceipts.medicineId, medicines.id))
          .where(inArray(stockReceipts.id, idsOf('stock_receipts')))
      : [],
    idsOf('shifts').length
      ? db
          .select({id: shifts.id, user: users.name, openedAt: shifts.openedAt})
          .from(shifts)
          .innerJoin(users, eq(shifts.userId, users.id))
          .where(inArray(shifts.id, idsOf('shifts')))
      : []
  ]);
  const saleMedicines: Record<number, string[]> = {};
  for (const {id, medicine} of saleRows) (saleMedicines[id] ??= []).push(medicine);
  return {
    medicines: Object.fromEntries(medicineRows.map(({id, name}) => [id, name])) as Record<number, string>,
    users: Object.fromEntries(userRows.map(({id, name}) => [id, name])) as Record<number, string>,
    categories: Object.fromEntries(categoryRows.map(({id, name}) => [id, name])) as Record<number, string>,
    expenses: Object.fromEntries(
      expenseRows.map(({id, category, description}) => [id, category ?? description ?? ''])
    ) as Record<number, string>,
    sales: saleMedicines,
    stockReceipts: Object.fromEntries(
      receiptRows.map(({id, medicine, quantity}) => [id, {medicine, quantity}])
    ) as Record<number, {medicine: string; quantity: number}>,
    shifts: Object.fromEntries(
      shiftRows.map(({id, user, openedAt}) => [id, {user, openedAt}])
    ) as Record<number, {user: string; openedAt: Date}>
  };
}
