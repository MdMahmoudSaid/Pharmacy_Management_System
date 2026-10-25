import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key
}));

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {expenses, sales} from '@/db/schema';
import {recordCapitalMovement} from '@/modules/accounts/service';
import {createExpense} from '@/modules/expenses/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {getReportData} from '@/modules/reports/queries';
import {buildReport} from '@/modules/reports/builders';
import {getDashboardSummary} from '@/modules/dashboard/queries';
import {createSale} from '@/modules/sales/service';
import {receiveStock} from '@/modules/stock/service';
import {createSupplier, recordSupplierPayment} from '@/modules/suppliers/service';
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

    const dashboard = await getDashboardSummary(admin, {
      from: new Date('2020-01-01T00:00:00Z'),
      to: new Date('2030-01-01T00:00:00Z')
    });
    expect(dashboard.recentOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({kind: 'sale', id: cancelledSale.id, cancelled: true}),
        expect.objectContaining({kind: 'expense', id: activeExpense.id, amount: '5.00', cancelled: false})
      ])
    );
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
    const dashboard = await getDashboardSummary(employee, range);
    expect(report.stock).toEqual([]);
    expect(report.employees).toEqual([{id: employee.id, name: employeeUser.name, isActive: true}]);
    expect(dashboard.openShifts).toEqual([]);
    expect(dashboard.recentOperations).toEqual([]);
  });

  it('builds cash-flow and supplier balance reports from the connected ledgers', async () => {
    const shift = await createShift({userId: admin.id});
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '100.00'});
    const supplier = await createSupplier(admin, {name: 'Rapport fournisseur'});
    const medicine = await createMedicine({sellingPrice: '20.00'});
    await receiveStock(admin, {medicineId: medicine.id, supplierId: supplier.id, quantity: 2, unitCost: '10.00', sellingPrice: '20.00'});
    await createSale(admin, {shiftId: shift.id, idempotencyKey: 'cash-report', items: [{medicineId: medicine.id, quantity: 1}]});
    await createExpense(admin, {shiftId: shift.id, amount: '5.00', description: 'Transport'});
    await recordSupplierPayment(admin, {supplierId: supplier.id, amount: '15.00'});
    const filters = {
      preset: 'custom' as const,
      from: '2020-01-01',
      to: '2029-12-31',
      range: {from: new Date('2020-01-01T00:00:00Z'), to: new Date('2030-01-01T00:00:00Z')}
    };

    // 20 sold, 10 of it is the cost of the medicine, 5 of expenses: 5 is left.
    const period = await getReportData(admin, filters.range);
    expect(period.summary).toMatchObject({salesTotal: '20.00', costOfGoods: '10.00', expensesTotal: '5.00', netTotal: '5.00'});

    const cash = await buildReport(admin, 'cash-flow', filters, 'fr');
    expect(cash.rows).toHaveLength(4);
    expect(cash.primary.value).toBe('100.00');
    const balances = await buildReport(admin, 'supplier-balances', filters, 'fr');
    expect(balances.rows).toHaveLength(1);
    expect(balances.rows[0]?.[4]?.value).toBe('5.00');
  });
});
