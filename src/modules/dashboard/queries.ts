import {and, eq, inArray} from 'drizzle-orm';

import {db} from '@/db/client';
import {medicines, saleItems, shifts, users} from '@/db/schema';
import {can, type PermissionActor} from '@/modules/permissions/service';
import {getReportData} from '@/modules/reports/queries';

export type RecentOperation =
  | {kind: 'sale'; id: number; at: Date; amount: string; cancelled: boolean; medicines: string[]}
  | {kind: 'expense'; id: number; at: Date; amount: string; cancelled: boolean; description: string}
  | {kind: 'stock'; id: number; at: Date; quantity: number; medicineName: string};

const RECENT_LIMIT = 8;

export async function getDashboardSummary(actor: PermissionActor, range: {from: Date; to: Date}) {
  const report = await getReportData(actor, range);
  const mayViewAllShifts = can(actor, 'shifts.view.all');
  const mayViewOwnShifts = can(actor, 'shifts.view.own', actor.id);
  const receipts = report.movements.filter(({type}) => type === 'STOCK_RECEIVED');
  const medicineIds = [...new Set(receipts.map(({medicineId}) => medicineId))];
  const [openShifts, medicineRows] = await Promise.all([
    mayViewAllShifts
      ? db.select().from(shifts).where(eq(shifts.status, 'OPEN'))
      : mayViewOwnShifts
        ? db.select().from(shifts).where(and(eq(shifts.status, 'OPEN'), eq(shifts.userId, actor.id)))
        : Promise.resolve([]),
    medicineIds.length
      ? db.select({id: medicines.id, name: medicines.name}).from(medicines).where(inArray(medicines.id, medicineIds))
      : Promise.resolve([])
  ]);
  const medicineNames = new Map(medicineRows.map(({id, name}) => [id, name]));

  const recentOperations: RecentOperation[] = [
    ...report.sales.map((sale) => ({
      kind: 'sale' as const,
      id: sale.id,
      at: sale.createdAt,
      amount: sale.total,
      cancelled: sale.status === 'CANCELLED',
      medicines: [] as string[]
    })),
    ...report.expenses.map((expense) => ({
      kind: 'expense' as const,
      id: expense.id,
      at: expense.occurredAt,
      amount: expense.amount,
      cancelled: expense.status === 'CANCELLED',
      description: expense.categoryName ?? expense.description ?? ''
    })),
    ...receipts.map((movement) => ({
      kind: 'stock' as const,
      id: movement.id,
      at: movement.createdAt,
      quantity: movement.quantityChange,
      medicineName: medicineNames.get(movement.medicineId) ?? String(movement.medicineId)
    }))
  ]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, RECENT_LIMIT);

  const saleIds = recentOperations.filter(({kind}) => kind === 'sale').map(({id}) => id);
  if (saleIds.length) {
    const items = await db
      .select({saleId: saleItems.saleId, name: medicines.name})
      .from(saleItems)
      .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
      .where(inArray(saleItems.saleId, saleIds));
    for (const operation of recentOperations) {
      if (operation.kind === 'sale') {
        operation.medicines = items.filter(({saleId}) => saleId === operation.id).map(({name}) => name);
      }
    }
  }

  return {summary: report.summary, stockUnits: report.stockUnits, openShifts, recentOperations};
}

export async function getUserName(userId: number) {
  const [user] = await db.select({name: users.name}).from(users).where(eq(users.id, userId)).limit(1);
  return user?.name ?? '';
}
