import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {auditLogs, sessions, shifts, userPermissions, users} from '@/db/schema';
import {authenticate} from '@/modules/auth/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {
  archiveEmployee,
  createEmployee,
  replaceEmployeePin,
  restoreEmployee,
  setEmployeePermissions,
  updateEmployee
} from '@/modules/users/service';
import {createShift, createUser, resetDatabase} from '../../factories/database';

describe('employee management', () => {
  let admin: PermissionActor;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser({role: 'ADMIN'});
    admin = {id: user.id, role: 'ADMIN', isActive: true, permissions: []};
  });

  it('creates an Arabic-default employee and preserves unique phones', async () => {
    const employee = await createEmployee(admin, {
      name: 'Ahmed',
      phone: '21234567',
      pin: '1234'
    });

    expect(employee).toMatchObject({
      phoneE164: '+22221234567',
      preferredLocale: 'ar',
      role: 'EMPLOYEE'
    });
    expect(employee).not.toHaveProperty('pinHash');
    await expect(
      createEmployee(admin, {name: 'Other', phone: '21234567', pin: '5678'})
    ).rejects.toBeDefined();
  });

  it('grants and revokes fixed permissions with a reasoned audit entry', async () => {
    const employee = await createEmployee(admin, {
      name: 'Mariam',
      phone: '31234567',
      pin: '1234'
    });

    await setEmployeePermissions(
      admin,
      employee.id,
      ['sales.create.own', 'stock.receive.own'],
      'Responsabilités du poste'
    );
    await setEmployeePermissions(
      admin,
      employee.id,
      ['sales.create.own'],
      'Changement de responsabilités'
    );

    const grants = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, employee.id));
    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'PERMISSION_CHANGE'));
    expect(grants.map((grant) => grant.permissionKey)).toEqual([
      'sales.create.own'
    ]);
    expect(audits).toHaveLength(2);
    expect(audits[1]).toMatchObject({
      reason: 'Changement de responsabilités',
      oldValues: {permissions: ['sales.create.own', 'stock.receive.own']},
      newValues: {permissions: ['sales.create.own']}
    });
  });

  it('edits public employee fields without exposing or auditing the PIN hash', async () => {
    const employee = await createEmployee(admin, {
      name: 'Ancien nom',
      phone: '31234567',
      pin: '1234'
    });

    const updated = await updateEmployee(admin, {
      id: employee.id,
      name: 'Nouveau nom',
      phone: '41234567'
    });
    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'UPDATE'));

    expect(updated).toMatchObject({
      name: 'Nouveau nom',
      phoneE164: '+22241234567'
    });
    expect(JSON.stringify(audits)).not.toContain('pinHash');
  });

  it.each(['archive', 'restore', 'reset_pin', 'permissions'] as const)(
    'requires a reason for %s',
    async (operation) => {
      const employee = await createEmployee(admin, {
        name: 'Reason Test',
        phone: '41234567',
        pin: '1234'
      });
      const call = {
        archive: () => archiveEmployee(admin, employee.id, '   '),
        restore: () => restoreEmployee(admin, employee.id, ''),
        reset_pin: () => replaceEmployeePin(admin, employee.id, '5678', ''),
        permissions: () =>
          setEmployeePermissions(admin, employee.id, [], '   ')
      }[operation];

      await expect(call()).rejects.toBeDefined();
    }
  );

  it('archives without deleting history and revokes active sessions', async () => {
    const employee = await createEmployee(admin, {
      name: 'Historical User',
      phone: '21234567',
      pin: '1234'
    });
    await createShift({userId: employee.id});
    await authenticate('21234567', '1234', 'archive-test');

    await archiveEmployee(admin, employee.id, 'Départ de l’employé');

    const [storedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, employee.id));
    const [storedSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, employee.id));
    const history = await db
      .select()
      .from(shifts)
      .where(eq(shifts.userId, employee.id));
    expect(storedUser.isActive).toBe(false);
    expect(storedSession.revokedAt).toBeInstanceOf(Date);
    expect(history).toHaveLength(1);
    await expect(
      authenticate('21234567', '1234', 'archived-login')
    ).rejects.toMatchObject({code: 'AUTHENTICATION_FAILED'});
  });

  it('resets the PIN, revokes sessions, and never audits hashes', async () => {
    const employee = await createEmployee(admin, {
      name: 'PIN Test',
      phone: '31234567',
      pin: '1234'
    });
    await authenticate('31234567', '1234', 'pin-reset-test');

    await replaceEmployeePin(admin, employee.id, '5678', 'Code oublié');

    await expect(
      authenticate('31234567', '5678', 'pin-reset-new')
    ).resolves.toBeDefined();
    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'RESET_PIN'));
    expect(JSON.stringify(audit)).not.toContain('$argon2');
    expect(audit.reason).toBe('Code oublié');
  });
});
