import {desc, eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {shifts, users} from '@/db/schema';
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
