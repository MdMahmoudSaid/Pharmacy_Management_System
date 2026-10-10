import {eq} from 'drizzle-orm';

import {AppError} from '@/lib/errors';
import {isPermissionKey, PERMISSION_KEYS, type PermissionKey} from './catalog';

export type PermissionActor = {
  id: number;
  role: 'ADMIN' | 'EMPLOYEE';
  isActive: boolean;
  permissions: readonly PermissionKey[];
};

function allScopeCounterpart(permission: PermissionKey): PermissionKey | null {
  if (!permission.endsWith('.own')) return null;
  const candidate = `${permission.slice(0, -4)}.all`;
  return isPermissionKey(candidate) ? candidate : null;
}

export function authorize(
  actor: PermissionActor,
  permission: PermissionKey,
  ownerId?: number
): void {
  if (!actor.isActive) throw new AppError('FORBIDDEN');
  if (actor.role === 'ADMIN') return;

  const grants = new Set(actor.permissions);
  const allPermission = allScopeCounterpart(permission);
  if (allPermission && grants.has(allPermission)) return;

  if (!grants.has(permission)) throw new AppError('FORBIDDEN');
  if (permission.endsWith('.own') && ownerId !== actor.id) {
    throw new AppError('FORBIDDEN');
  }
}

export async function loadPermissionActor(
  userId: number
): Promise<PermissionActor> {
  const [{db}, {userPermissions, users}] = await Promise.all([
    import('@/db/client'),
    import('@/db/schema')
  ]);
  const [user] = await db
    .select({id: users.id, role: users.role, isActive: users.isActive})
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError('SESSION_REQUIRED');

  const rows = await db
    .select({key: userPermissions.permissionKey})
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));

  return {
    ...user,
    permissions: rows.map(({key}) => key).filter(isPermissionKey)
  };
}

export async function syncPermissionCatalog(): Promise<void> {
  const [{db}, {permissions}] = await Promise.all([
    import('@/db/client'),
    import('@/db/schema')
  ]);
  await db
    .insert(permissions)
    .values(
      PERMISSION_KEYS.map((key) => {
        const [domain, action, scope] = key.split('.');
        return {
          key,
          domain,
          action,
          scope: scope.toUpperCase() as 'OWN' | 'ALL' | 'NONE'
        };
      })
    )
    .onConflictDoNothing();
}
