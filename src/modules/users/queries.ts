import {asc, eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {userPermissions, users} from '@/db/schema';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

const publicEmployeeColumns = {
  id: users.id,
  name: users.name,
  phoneE164: users.phoneE164,
  role: users.role,
  preferredLocale: users.preferredLocale,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
};

export async function listEmployees(actor: PermissionActor) {
  authorize(actor, 'employees.view.all');
  return db
    .select(publicEmployeeColumns)
    .from(users)
    .orderBy(asc(users.name));
}

export async function getEmployeePermissions(
  actor: PermissionActor,
  userId: number
) {
  authorize(actor, 'permissions.manage.all');
  const rows = await db
    .select({key: userPermissions.permissionKey})
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
  return rows.map(({key}) => key);
}
