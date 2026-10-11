import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {
  auditLogs,
  expenses,
  sales,
  shifts,
  stockReceipts
} from '@/db/schema';
import type {PermissionActor} from '@/modules/permissions/service';
import {
  closeShift,
  correctShift,
  getShiftSummary,
  openShift,
  reopenShift,
  requireActiveShift
} from '@/modules/shifts/service';
import {
  createMedicine,
  createUser,
  resetDatabase
} from '../../factories/database';

describe('shift lifecycle', () => {
  let employee: PermissionActor;
  let admin: PermissionActor;
  const firstTime = new Date('2026-10-10T08:00:00.000Z');

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const adminUser = await createUser({role: 'ADMIN'});
    const employeeUser = await createUser();
    admin = {id: adminUser.id, role: 'ADMIN', isActive: true, permissions: []};
    employee = {
      id: employeeUser.id,
      role: 'EMPLOYEE',
      isActive: true,
      permissions: ['shifts.open.own', 'shifts.close.own', 'shifts.view.own']
    };
  });

  it('prevents a second active shift and returns the current one', async () => {
    const opened = await openShift(employee, firstTime);

    await expect(
      openShift(employee, new Date('2026-10-10T09:00:00.000Z'))
    ).rejects.toMatchObject({code: 'SHIFT_ALREADY_OPEN'});
    await expect(requireActiveShift(employee.id)).resolves.toMatchObject({
      id: opened.id,
      userId: employee.id,
      status: 'OPEN'
    });
  });

  it('allows an administrator to open an operational shift for themselves', async () => {
    const shift = await openShift(admin, firstTime);
    expect(shift).toMatchObject({userId: admin.id, status: 'OPEN'});
  });

  it('closes an owned shift and records old and new audit values', async () => {
    const shift = await openShift(employee, firstTime);
    const closedAt = new Date('2026-10-10T16:00:00.000Z');

    await closeShift(employee, shift.id, closedAt);

    const [stored] = await db.select().from(shifts).where(eq(shifts.id, shift.id));
    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, shift.id));
    expect(stored).toMatchObject({status: 'CLOSED', closedAt});
    expect(audits.at(-1)).toMatchObject({
      action: 'UPDATE',
      oldValues: {status: 'OPEN', closedAt: null},
      newValues: {status: 'CLOSED', closedAt: closedAt.toISOString()}
    });
    await expect(requireActiveShift(employee.id)).rejects.toMatchObject({
      code: 'SHIFT_REQUIRED'
    });
  });

  it('requires permission to correct or reopen a shift and a reason only to reopen', async () => {
    const shift = await openShift(employee, firstTime);
    await closeShift(employee, shift.id, new Date('2026-10-10T16:00:00.000Z'));

    await expect(
      reopenShift(employee, {shiftId: shift.id, reason: 'Correction'})
    ).rejects.toMatchObject({code: 'FORBIDDEN'});
    await expect(
      reopenShift(admin, {shiftId: shift.id, reason: '   '})
    ).rejects.toBeDefined();
    await expect(
      correctShift(admin, {
        shiftId: shift.id,
        openedAt: firstTime,
        closedAt: new Date('2026-10-10T15:30:00.000Z'),
        reason: ''
      })
    ).resolves.toMatchObject({closedAt: new Date('2026-10-10T15:30:00.000Z')});
  });

  it('corrects timestamps and reopens with reasoned audit entries', async () => {
    const shift = await openShift(employee, firstTime);
    await closeShift(employee, shift.id, new Date('2026-10-10T16:00:00.000Z'));
    const correctedClose = new Date('2026-10-10T15:30:00.000Z');

    await correctShift(admin, {
      shiftId: shift.id,
      openedAt: new Date('2026-10-10T07:55:00.000Z'),
      closedAt: correctedClose,
      reason: 'Correction de pointage'
    });
    await reopenShift(admin, {
      shiftId: shift.id,
      reason: 'Fermeture faite par erreur'
    });

    const [stored] = await db.select().from(shifts).where(eq(shifts.id, shift.id));
    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, shift.id));
    expect(stored).toMatchObject({status: 'OPEN', closedAt: null});
    expect(audits.map(({action}) => action)).toContain('CORRECT');
    expect(audits.at(-1)).toMatchObject({
      action: 'REOPEN',
      reason: 'Fermeture faite par erreur'
    });
  });

  it('derives its summary only from active linked transactions', async () => {
    const shift = await openShift(employee, firstTime);
    const medicine = await createMedicine();
    await db.insert(sales).values([
      {
        saleNumber: 'S-ACTIVE',
        shiftId: shift.id,
        operatorId: employee.id,
        total: '500.00',
        status: 'COMPLETED',
        idempotencyKey: 'active'
      },
      {
        saleNumber: 'S-CANCELLED',
        shiftId: shift.id,
        operatorId: employee.id,
        total: '900.00',
        status: 'CANCELLED',
        idempotencyKey: 'cancelled'
      }
    ]);
    await db.insert(expenses).values([
      {
        amount: '125.50',
        description: 'Active',
        shiftId: shift.id,
        operatorId: employee.id,
        status: 'ACTIVE',
        occurredAt: firstTime
      },
      {
        amount: '300.00',
        description: 'Cancelled',
        shiftId: shift.id,
        operatorId: employee.id,
        status: 'CANCELLED',
        occurredAt: firstTime
      }
    ]);
    await db.insert(stockReceipts).values([
      {
        medicineId: medicine.id,
        quantity: 10,
        status: 'ACTIVE',
        shiftId: shift.id,
        operatorId: employee.id,
        createdBy: employee.id
      },
      {
        medicineId: medicine.id,
        quantity: 40,
        status: 'CANCELLED',
        shiftId: shift.id,
        operatorId: employee.id,
        createdBy: employee.id
      }
    ]);

    await expect(getShiftSummary(shift.id)).resolves.toMatchObject({
      salesTotal: '500.00',
      expensesTotal: '125.50',
      stockReceived: 10
    });
  });
});
