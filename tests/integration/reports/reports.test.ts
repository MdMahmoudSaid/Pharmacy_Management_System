import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {expenses, sales} from '@/db/schema';
import {createExpense} from '@/modules/expenses/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {getReportData} from '@/modules/reports/queries';
import {getDashboardSummary} from '@/modules/dashboard/queries';
import {createSale} from '@/modules/sales/service';
import {
  createMedicine,
  createShift,
  createUser,
  resetDatabase
} from '../../factories/database';

describe('source-of-truth reports', () => {
  let admin: PermissionActor;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser({role: 'ADMIN'});
    admin = {id: user.id, role: 'ADMIN', isActive: true, permissions: []};
  });

  it('counts active sources and retains cancelled detail rows', async () => {
    const shift = await createShift({userId: admin.id});
    const medicine = await createMedicine({currentStock: 20, sellingPrice: '10.00'});
    const activeSale = await createSale(admin, {
      shiftId: shift.id,
      idempotencyKey: 'report-active',
      items: [{medicineId: medicine.id, quantity: 2}]
    });
    const cancelledSale = await createSale(admin, {
      shiftId: shift.id,
      idempotencyKey: 'report-cancelled',
      items: [{medicineId: medicine.id, quantity: 1}]
    });
    await db.update(sales).set({status: 'CANCELLED'}).where(eq(sales.id, cancelledSale.id));
    const activeExpense = await createExpense(admin, {
      shiftId: shift.id,
      amount: '5.00',
      description: 'Active'
    });
    const cancelledExpense = await createExpense(admin, {
      shiftId: shift.id,
      amount: '7.00',
      description: 'Cancelled'
    });
    await db
      .update(expenses)
      .set({status: 'CANCELLED'})
      .where(eq(expenses.id, cancelledExpense.id));

    const report = await getReportData(admin, {
      from: new Date('2020-01-01T00:00:00Z'),
      to: new Date('2030-01-01T00:00:00Z')
    });
    expect(report.summary).toMatchObject({salesTotal: '20.00', expensesTotal: '5.00'});
    expect(report.summary.netTotal).toBe('15.00');
    expect(report.sales.map(({id}) => id)).toEqual(
      expect.arrayContaining([activeSale.id, cancelledSale.id])
    );
    expect(report.expenses.map(({id}) => id)).toEqual(
      expect.arrayContaining([activeExpense.id, cancelledExpense.id])
    );
    expect(report.stockUnits).toBe(17);
  });

  it('does not expose global stock, employees, shifts, or audit to own scope', async () => {
    const employeeUser = await createUser();
    const otherUser = await createUser();
    await createShift({userId: employeeUser.id});
    await createShift({userId: otherUser.id});
    await createMedicine({name: 'Global secret stock', currentStock: 99});
    const employee: PermissionActor = {
      id: employeeUser.id,
      role: 'EMPLOYEE',
      isActive: true,
      permissions: ['reports.view.own']
    };
    const range = {from: new Date('2020-01-01'), to: new Date('2030-01-01')};
    const report = await getReportData(employee, range);
    const dashboard = await getDashboardSummary(employee, new Date('2026-10-10T12:00:00Z'));
    expect(report.stock).toEqual([]);
    expect(report.employees).toEqual([{id: employee.id, name: employeeUser.name, isActive: true}]);
    expect(dashboard.openShifts).toEqual([]);
    expect(dashboard.recentActivity).toEqual([]);
  });
});
