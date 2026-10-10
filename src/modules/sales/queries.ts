import {desc, eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {sales, users} from '@/db/schema';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

export async function listSales(actor: PermissionActor) {
  authorize(actor, 'sales.view.own', actor.id);
  const base = db
    .select({sale: sales, operatorName: users.name})
    .from(sales)
    .innerJoin(users, eq(sales.operatorId, users.id));
  const mayViewAll =
    actor.role === 'ADMIN' || actor.permissions.includes('sales.view.all');
  return mayViewAll
    ? base.orderBy(desc(sales.createdAt))
    : base.where(eq(sales.operatorId, actor.id)).orderBy(desc(sales.createdAt));
}
