import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {
  capitalMovements,
  expenses,
  saleItems,
  sales,
  stockReceipts,
  supplierPayments
} from '@/db/schema';
import {eq} from 'drizzle-orm';
import {getAccountsOverview} from '@/modules/accounts/queries';
import {recordCapitalMovement} from '@/modules/accounts/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {createSupplier} from '@/modules/suppliers/service';
import {
  createMedicine,
  createShift,
  createUser,
  resetDatabase
} from '../../factories/database';

describe('owner accounts', () => {
  let admin: PermissionActor;
  let employee: PermissionActor;
  let shiftId: number;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const adminUser = await createUser({role: 'ADMIN'});
    const employeeUser = await createUser({role: 'EMPLOYEE'});
    admin = {id: adminUser.id, role: 'ADMIN', isActive: true, permissions: []};
    employee = {id: employeeUser.id, role: 'EMPLOYEE', isActive: true, permissions: []};
    shiftId = (await createShift({userId: admin.id})).id;
  });

  it('separates capital from profit and independently derives every overview total', async () => {
    const medicine = await createMedicine({currentStock: 10, averageCost: '4.00'});
    const debtSupplier = await createSupplier(admin, {name: 'Debt Supplier'});
    const advanceSupplier = await createSupplier(admin, {name: 'Advance Supplier'});
    await db.insert(stockReceipts).values({
      medicineId: medicine.id,
      supplierId: debtSupplier.id,
      quantity: 5,
      unitCost: '20.00',
      totalCost: '100.00',
      shiftId,
      operatorId: admin.id,
      createdBy: admin.id
    });
    await db.insert(supplierPayments).values([
      {supplierId: debtSupplier.id, amount: '20.00', operatorId: admin.id},
      {supplierId: advanceSupplier.id, amount: '15.00', operatorId: admin.id}
    ]);

    const [completed, cancelled] = await db
      .insert(sales)
      .values([
        {saleNumber: 'ACC-1', shiftId, operatorId: admin.id, total: '30.00', idempotencyKey: 'acc-1'},
        {saleNumber: 'ACC-2', shiftId, operatorId: admin.id, total: '100.00', status: 'CANCELLED', idempotencyKey: 'acc-2'}
      ])
      .returning();
    await db.insert(saleItems).values([
      {saleId: completed.id, medicineId: medicine.id, quantity: 3, unitPrice: '10.00', unitCost: '4.00', lineTotal: '30.00'},
      {saleId: cancelled.id, medicineId: medicine.id, quantity: 1, unitPrice: '100.00', unitCost: '1.00', lineTotal: '100.00'}
    ]);
    await db.insert(expenses).values([
      {amount: '5.00', description: 'Active', shiftId, operatorId: admin.id},
      {amount: '7.00', description: 'Cancelled', shiftId, operatorId: admin.id, status: 'CANCELLED'}
    ]);
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '1000.00', note: 'Opening'});
    await recordCapitalMovement(admin, {
      type: 'WITHDRAWAL',
      amount: '200.00',
      source: 'CAPITAL',
      note: 'Owner draw'
    });

    const overview = await getAccountsOverview(admin);
    expect(overview.summary).toEqual({
      capital: '800.00',
      cash: '790.00',
      revenue: '30.00',
      costOfGoods: '12.00',
      grossProfit: '18.00',
      expenses: '5.00',
      netProfit: '13.00',
      // Cash (790) is below the capital (800): the profit is tied up in stock, none of it is in the cash box.
      withdrawableProfit: '0.00',
      inventoryValue: '40.00',
      supplierDebt: '80.00',
      supplierAdvances: '15.00'
    });
    expect(overview.movements.map(({type, amount, profitPortion, capitalPortion}) => ({type, amount, profitPortion, capitalPortion}))).toEqual([
      {type: 'WITHDRAWAL', amount: '200.00', profitPortion: '0.00', capitalPortion: '200.00'},
      {type: 'ADDITION', amount: '1000.00', profitPortion: '0.00', capitalPortion: '0.00'}
    ]);
  });

  it('filters performance and capital history without changing current balances', async () => {
    const medicine = await createMedicine({currentStock: 10, averageCost: '4.00'});
    const [septemberSale, octoberSale] = await db.insert(sales).values([
      {saleNumber: 'PERIOD-SEP', shiftId, operatorId: admin.id, total: '40.00', idempotencyKey: 'period-sep', createdAt: new Date('2026-09-15T12:00:00Z')},
      {saleNumber: 'PERIOD-OCT', shiftId, operatorId: admin.id, total: '50.00', idempotencyKey: 'period-oct', createdAt: new Date('2026-10-20T12:00:00Z')}
    ]).returning();
    await db.insert(saleItems).values([
      {saleId: septemberSale.id, medicineId: medicine.id, quantity: 1, unitPrice: '40.00', unitCost: '10.00', lineTotal: '40.00'},
      {saleId: octoberSale.id, medicineId: medicine.id, quantity: 1, unitPrice: '50.00', unitCost: '20.00', lineTotal: '50.00'}
    ]);
    await db.insert(expenses).values([
      {amount: '7.00', description: 'September', shiftId, operatorId: admin.id, occurredAt: new Date('2026-09-18T12:00:00Z')},
      {amount: '5.00', description: 'October', shiftId, operatorId: admin.id, occurredAt: new Date('2026-10-05T12:00:00Z')}
    ]);
    const septemberCapital = await recordCapitalMovement(admin, {type: 'ADDITION', amount: '100.00', note: 'September'});
    const octoberCapital = await recordCapitalMovement(admin, {type: 'ADDITION', amount: '20.00', note: 'October'});
    await db.update(capitalMovements).set({occurredAt: new Date('2026-09-10T12:00:00Z')}).where(eq(capitalMovements.id, septemberCapital.id));
    await db.update(capitalMovements).set({occurredAt: new Date('2026-10-10T12:00:00Z')}).where(eq(capitalMovements.id, octoberCapital.id));

    const overview = await getAccountsOverview(admin, {
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-11-01T00:00:00Z')
    });

    expect(overview.summary).toMatchObject({
      cash: '198.00',
      capital: '120.00',
      revenue: '50.00',
      costOfGoods: '20.00',
      grossProfit: '30.00',
      expenses: '5.00',
      netProfit: '25.00'
    });
    expect(overview.movements.map(({note}) => note)).toEqual(['October']);
  });

  it('enforces separate view and manage permissions', async () => {
    await expect(getAccountsOverview(employee)).rejects.toMatchObject({code: 'FORBIDDEN'});
    await expect(recordCapitalMovement(employee, {type: 'ADDITION', amount: '10.00'})).rejects.toMatchObject({code: 'FORBIDDEN'});
    const viewer = {...employee, permissions: ['accounts.view.all'] as const};
    await expect(getAccountsOverview(viewer)).resolves.toMatchObject({summary: {capital: '0.00'}});
    await expect(recordCapitalMovement(viewer, {type: 'ADDITION', amount: '10.00'})).rejects.toMatchObject({code: 'FORBIDDEN'});
  });

  it('rejects a withdrawal larger than the available capital balance', async () => {
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '100.00'});

    await expect(
      recordCapitalMovement(admin, {type: 'WITHDRAWAL', amount: '100.01'})
    ).rejects.toMatchObject({code: 'INSUFFICIENT_PROFIT'});

    await expect(getAccountsOverview(admin)).resolves.toMatchObject({
      summary: {capital: '100.00'}
    });
  });

  it('defaults withdrawals to profit and requires explicit consent before using capital', async () => {
    const medicine = await createMedicine();
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '100.00'});
    const [sale] = await db.insert(sales).values({
      saleNumber: 'PROFIT-1',
      shiftId,
      operatorId: admin.id,
      total: '50.00',
      idempotencyKey: 'profit-1'
    }).returning();
    await db.insert(saleItems).values({
      saleId: sale.id,
      medicineId: medicine.id,
      quantity: 1,
      unitPrice: '50.00',
      unitCost: '20.00',
      lineTotal: '50.00'
    });

    await expect(recordCapitalMovement(admin, {
      type: 'WITHDRAWAL',
      amount: '40.00',
      source: 'PROFIT'
    })).rejects.toMatchObject({code: 'CAPITAL_CONFIRMATION_REQUIRED'});

    const movement = await recordCapitalMovement(admin, {
      type: 'WITHDRAWAL',
      amount: '40.00',
      source: 'PROFIT',
      allowCapitalFallback: true
    });
    expect(movement).toMatchObject({
      amount: '40.00',
      profitPortion: '30.00',
      capitalPortion: '10.00'
    });
    await expect(getAccountsOverview(admin)).resolves.toMatchObject({
      summary: {
        cash: '110.00',
        capital: '90.00',
        netProfit: '30.00',
        withdrawableProfit: '0.00'
      }
    });
  });

  it('rejects a capital withdrawal that exceeds available capital or cash', async () => {
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '25.00'});
    await expect(recordCapitalMovement(admin, {
      type: 'WITHDRAWAL',
      source: 'CAPITAL',
      amount: '25.01'
    })).rejects.toMatchObject({code: 'INSUFFICIENT_CAPITAL'});

    await db.insert(expenses).values({
      amount: '20.00',
      description: 'Existing outflow',
      shiftId,
      operatorId: admin.id
    });
    await expect(recordCapitalMovement(admin, {
      type: 'WITHDRAWAL',
      source: 'CAPITAL',
      amount: '6.00'
    })).rejects.toMatchObject({code: 'INSUFFICIENT_CASH'});
  });
});
