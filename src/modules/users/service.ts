import {and, eq, isNull} from 'drizzle-orm';

import {db} from '@/db/client';
import {sessions, userPermissions, users} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {hashPin} from '@/modules/auth/service';
import {normalizeMauritanianPhone, pinSchema} from '@/modules/auth/schemas';
import {ROLE_PRESETS, type PermissionKey, type RolePresetKey} from '@/modules/permissions/catalog';
import {
  authorize,
  type PermissionActor,
  syncPermissionCatalog
} from '@/modules/permissions/service';
import {
  createEmployeeSchema,
  employeePermissionsSchema,
  employeeReasonSchema,
  updateEmployeeSchema
} from './schemas';

export type EmployeeView = {
  id: number;
  name: string;
  phoneE164: string;
  role: 'ADMIN' | 'EMPLOYEE';
  preferredLocale: 'ar' | 'fr';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const employeeColumns = {
  id: users.id,
  name: users.name,
  phoneE164: users.phoneE164,
  role: users.role,
  preferredLocale: users.preferredLocale,
  isActive: users.isActive,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt
};

async function requireEmployee(userId: number) {
  const [employee] = await db
    .select({
      id: users.id,
      name: users.name,
      phoneE164: users.phoneE164,
      role: users.role,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!employee || employee.role !== 'EMPLOYEE') throw new AppError('NOT_FOUND');
  return employee;
}

export async function createEmployee(
  actor: PermissionActor,
  input: {name: string; phone: string; pin: string; preset?: string}
): Promise<EmployeeView> {
  authorize(actor, 'employees.create.all');
  const value = createEmployeeSchema.parse(input);
  const presetPermissions: readonly PermissionKey[] = value.preset ? ROLE_PRESETS[value.preset as RolePresetKey] : [];
  if (presetPermissions.length) {
    authorize(actor, 'permissions.manage.all');
    await syncPermissionCatalog();
  }
  const pinHash = await hashPin(value.pin);

  return db.transaction(async (tx) => {
    const [employee] = await tx
      .insert(users)
      .values({
        name: value.name,
        phoneE164: normalizeMauritanianPhone(value.phone),
        pinHash,
        role: 'EMPLOYEE',
        preferredLocale: 'ar',
        createdBy: actor.id,
        updatedBy: actor.id
      })
      .returning(employeeColumns);
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'users',
      entityId: employee.id,
      action: 'CREATE',
      newValues: {
        name: employee.name,
        phoneE164: employee.phoneE164,
        role: employee.role
      }
    });
    if (presetPermissions.length) {
      await tx.insert(userPermissions).values(
        presetPermissions.map((permissionKey) => ({userId: employee.id, permissionKey, grantedBy: actor.id}))
      );
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'users',
        entityId: employee.id,
        action: 'PERMISSION_CHANGE',
        oldValues: {permissions: []},
        newValues: {permissions: [...presetPermissions].sort(), preset: value.preset}
      });
    }
    return employee;
  });
}

export async function updateEmployee(
  actor: PermissionActor,
  input: {id: number; name: string; phone: string}
): Promise<EmployeeView> {
  authorize(actor, 'employees.update.all');
  const value = updateEmployeeSchema.parse(input);
  const current = await requireEmployee(value.id);

  return db.transaction(async (tx) => {
    const [employee] = await tx
      .update(users)
      .set({
        name: value.name,
        phoneE164: normalizeMauritanianPhone(value.phone),
        updatedBy: actor.id,
        updatedAt: new Date()
      })
      .where(eq(users.id, value.id))
      .returning(employeeColumns);
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'users',
      entityId: employee.id,
      action: 'UPDATE',
      oldValues: current,
      newValues: {name: employee.name, phoneE164: employee.phoneE164}
    });
    return employee;
  });
}

async function setEmployeeActive(
  actor: PermissionActor,
  userId: number,
  isActive: boolean,
  reason: string
): Promise<void> {
  authorize(
    actor,
    isActive ? 'employees.restore.all' : 'employees.archive.all'
  );
  const cleanReason = employeeReasonSchema.parse(reason);
  const employee = await requireEmployee(userId);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({isActive, updatedBy: actor.id, updatedAt: new Date()})
      .where(eq(users.id, userId));
    if (!isActive) {
      await tx
        .update(sessions)
        .set({revokedAt: new Date()})
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    }
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'users',
      entityId: userId,
      action: isActive ? 'RESTORE' : 'ARCHIVE',
      oldValues: {isActive: employee.isActive},
      newValues: {isActive},
      reason: cleanReason
    });
  });
}

export const archiveEmployee = (
  actor: PermissionActor,
  userId: number,
  reason: string
) => setEmployeeActive(actor, userId, false, reason);

export const restoreEmployee = (
  actor: PermissionActor,
  userId: number,
  reason: string
) => setEmployeeActive(actor, userId, true, reason);

export async function replaceEmployeePin(
  actor: PermissionActor,
  userId: number,
  pin: string,
  reason: string
): Promise<void> {
  authorize(actor, 'employees.reset_pin.all');
  const cleanReason = employeeReasonSchema.parse(reason);
  pinSchema.parse(pin);
  await requireEmployee(userId);
  const pinHash = await hashPin(pin);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({pinHash, updatedBy: actor.id, updatedAt: new Date()})
      .where(eq(users.id, userId));
    await tx
      .update(sessions)
      .set({revokedAt: new Date()})
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'users',
      entityId: userId,
      action: 'RESET_PIN',
      newValues: {pinReset: true},
      reason: cleanReason
    });
  });
}

export async function setEmployeePermissions(
  actor: PermissionActor,
  userId: number,
  requestedPermissions: PermissionKey[],
  reason: string
): Promise<void> {
  authorize(actor, 'permissions.manage.all');
  const cleanReason = employeeReasonSchema.parse(reason);
  const permissionKeys = [
    ...new Set(employeePermissionsSchema.parse(requestedPermissions))
  ].sort();
  await requireEmployee(userId);
  await syncPermissionCatalog();

  await db.transaction(async (tx) => {
    const oldRows = await tx
      .select({key: userPermissions.permissionKey})
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
    const oldPermissions = oldRows.map(({key}) => key).sort();
    await tx
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId));
    if (permissionKeys.length > 0) {
      await tx.insert(userPermissions).values(
        permissionKeys.map((permissionKey) => ({
          userId,
          permissionKey,
          grantedBy: actor.id
        }))
      );
    }
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'users',
      entityId: userId,
      action: 'PERMISSION_CHANGE',
      oldValues: {permissions: oldPermissions},
      newValues: {permissions: permissionKeys},
      reason: cleanReason
    });
  });
}

export async function replaceUserPin(userId: number, pin: string): Promise<void> {
  const pinHash = await hashPin(pin);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({pinHash, updatedAt: new Date()})
      .where(eq(users.id, userId));
    await tx
      .update(sessions)
      .set({revokedAt: new Date()})
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  });
}
