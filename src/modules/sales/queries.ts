import {and, desc, eq, gte, inArray, lt} from 'drizzle-orm';

import {db} from '@/db/client';
import {medicines, saleItems, sales, users} from '@/db/schema';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

export async function listSales(actor: PermissionActor, range: {from?: Date; to?: Date} = {}) {
  authorize(actor, 'sales.view.own', actor.id);
  const mayViewAll =
    actor.role === 'ADMIN' || actor.permissions.includes('sales.view.all');
  const rows = await db
    .select({sale: sales, operatorName: users.name})
    .from(sales)
    .innerJoin(users, eq(sales.operatorId, users.id))
    .where(
      and(
        mayViewAll ? undefined : eq(sales.operatorId, actor.id),
        range.from ? gte(sales.createdAt, range.from) : undefined,
        range.to ? lt(sales.createdAt, range.to) : undefined
      )
    )
    .orderBy(desc(sales.createdAt), desc(sales.id))
    .limit(300);
  const ids = rows.map(({sale}) => sale.id);
  const items = ids.length
    ? await db
        .select({saleId: saleItems.saleId, name: medicines.name, quantity: saleItems.quantity})
        .from(saleItems)
        .innerJoin(medicines, eq(saleItems.medicineId, medicines.id))
        .where(inArray(saleItems.saleId, ids))
    : [];
  return rows.map((row) => ({
    ...row,
    items: items.filter(({saleId}) => saleId === row.sale.id).map(({name, quantity}) => ({name, quantity}))
  }));
}
