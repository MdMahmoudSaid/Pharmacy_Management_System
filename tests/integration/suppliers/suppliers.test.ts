import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {stockReceipts, supplierPayments} from '@/db/schema';
import type {PermissionActor} from '@/modules/permissions/service';
import {getSupplierDetail, listSuppliers} from '@/modules/suppliers/queries';
import {recordCapitalMovement} from '@/modules/accounts/service';
import {
  createSupplier,
  recordSupplierPayment,
  setSupplierActive,
  updateSupplier
} from '@/modules/suppliers/service';
import {
  createMedicine,
  createShift,
  createUser,
  resetDatabase
} from '../../factories/database';

describe('supplier account ledger', () => {
  let admin: PermissionActor;
  let employee: PermissionActor;
  let shiftId: number;
  let medicineId: number;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const adminUser = await createUser({role: 'ADMIN'});
    const employeeUser = await createUser({role: 'EMPLOYEE'});
    admin = {id: adminUser.id, role: 'ADMIN', isActive: true, permissions: []};
    employee = {id: employeeUser.id, role: 'EMPLOYEE', isActive: true, permissions: []};
    shiftId = (await createShift({userId: admin.id})).id;
    medicineId = (await createMedicine()).id;
  });

  it('creates and updates a supplier while active names stay unique', async () => {
    const supplier = await createSupplier(admin, {
      name: 'Nouakchott Pharma',
      phone: '22112233',
      contactPerson: 'Ahmed',
      address: 'Tevragh Zeina',
      note: 'Livraison le matin'
    });
    expect(supplier).toMatchObject({name: 'Nouakchott Pharma', phone: '22112233', isActive: true});

    await expect(createSupplier(admin, {name: '  nouakchott pharma  '})).rejects.toMatchObject({code: 'CONFLICT'});
    const updated = await updateSupplier(admin, {
      id: supplier.id,
      name: 'Nouakchott Pharma SARL',
      phone: '44112233',
      contactPerson: '',
      address: '',
      note: ''
    });
    expect(updated).toMatchObject({name: 'Nouakchott Pharma SARL', phone: '44112233', contactPerson: null});
  });

  it('authorizes supplier viewing, management, and payments independently', async () => {
    await expect(createSupplier(employee, {name: 'Blocked'})).rejects.toMatchObject({code: 'FORBIDDEN'});
    const manager = {...employee, permissions: ['suppliers.manage.all'] as const};
    const supplier = await createSupplier(manager, {name: 'Allowed'});
    await expect(recordSupplierPayment(manager, {supplierId: supplier.id, amount: '1.00'})).rejects.toMatchObject({code: 'FORBIDDEN'});
    await expect(listSuppliers(employee)).rejects.toMatchObject({code: 'FORBIDDEN'});
  });

  it('shows receipt debits and payment credits with a chronological running balance', async () => {
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '100.00'});
    const supplier = await createSupplier(admin, {name: 'Ledger Supplier'});
    await db.insert(stockReceipts).values([
      {
        medicineId,
        supplierId: supplier.id,
        quantity: 4,
        unitCost: '25.00',
        totalCost: '100.00',
        shiftId,
        operatorId: admin.id,
        occurredAt: new Date('2026-10-01T10:00:00Z'),
        createdBy: admin.id
      },
      {
        medicineId,
        supplierId: supplier.id,
        quantity: 2,
        unitCost: '25.00',
        totalCost: '50.00',
        shiftId,
        operatorId: admin.id,
        occurredAt: new Date('2026-10-03T10:00:00Z'),
        createdBy: admin.id
      }
    ]);
    await recordSupplierPayment(admin, {
      supplierId: supplier.id,
      amount: '40.00',
      occurredAt: new Date('2026-10-02T10:00:00Z'),
      reference: 'PAY-1'
    });

    const detail = await getSupplierDetail(admin, supplier.id);
    expect(detail.summary).toEqual({purchases: '150.00', payments: '40.00', balance: '110.00'});
    expect(detail.ledger.map(({kind, amount, runningBalance}) => ({kind, amount, runningBalance}))).toEqual([
      {kind: 'RECEIPT', amount: '100.00', runningBalance: '100.00'},
      {kind: 'PAYMENT', amount: '40.00', runningBalance: '60.00'},
      {kind: 'RECEIPT', amount: '50.00', runningBalance: '110.00'}
    ]);
  });

  it('allows overpayment as an advance and lists debt and advances separately', async () => {
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '35.00'});
    const debtSupplier = await createSupplier(admin, {name: 'Debt'});
    const advanceSupplier = await createSupplier(admin, {name: 'Advance'});
    await db.insert(stockReceipts).values({
      medicineId,
      supplierId: debtSupplier.id,
      quantity: 2,
      unitCost: '50.00',
      totalCost: '100.00',
      shiftId,
      operatorId: admin.id,
      createdBy: admin.id
    });
    await recordSupplierPayment(admin, {supplierId: advanceSupplier.id, amount: '35.00'});

    const result = await listSuppliers(admin);
    expect(result.totals).toEqual({debt: '100.00', advances: '35.00', purchases: '100.00', payments: '35.00'});
    expect(result.items.map(({name, balance}) => ({name, balance}))).toEqual([
      {name: 'Advance', balance: '-35.00'},
      {name: 'Debt', balance: '100.00'}
    ]);
  });

  it('archives only a zero-balance supplier and keeps its history', async () => {
    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '20.00'});
    const supplier = await createSupplier(admin, {name: 'Closable'});
    await db.insert(stockReceipts).values({
      medicineId,
      supplierId: supplier.id,
      quantity: 1,
      unitCost: '20.00',
      totalCost: '20.00',
      shiftId,
      operatorId: admin.id,
      createdBy: admin.id
    });
    await expect(setSupplierActive(admin, supplier.id, false)).rejects.toMatchObject({code: 'CONFLICT'});
    await recordSupplierPayment(admin, {supplierId: supplier.id, amount: '20.00'});
    await setSupplierActive(admin, supplier.id, false);

    await expect(listSuppliers(admin)).resolves.toMatchObject({items: []});
    const archived = await listSuppliers(admin, {includeArchived: true});
    expect(archived.items[0]).toMatchObject({name: 'Closable', isActive: false, balance: '0.00'});
    await expect(getSupplierDetail(admin, supplier.id)).resolves.toMatchObject({supplier: {isActive: false}});
  });

  it('rolls back a payment when its supplier does not exist', async () => {
    await expect(recordSupplierPayment(admin, {supplierId: 999999, amount: '25.00'})).rejects.toMatchObject({code: 'NOT_FOUND'});
    await expect(db.select().from(supplierPayments).where(eq(supplierPayments.supplierId, 999999))).resolves.toEqual([]);
  });

  it('rejects supplier payments without cash and serializes concurrent spending', async () => {
    const first = await createSupplier(admin, {name: 'First Cash Supplier'});
    const second = await createSupplier(admin, {name: 'Second Cash Supplier'});

    await expect(recordSupplierPayment(admin, {
      supplierId: first.id,
      amount: '1.00'
    })).rejects.toMatchObject({code: 'INSUFFICIENT_CASH'});

    await recordCapitalMovement(admin, {type: 'ADDITION', amount: '100.00'});
    const results = await Promise.allSettled([
      recordSupplierPayment(admin, {supplierId: first.id, amount: '60.00'}),
      recordSupplierPayment(admin, {supplierId: second.id, amount: '60.00'})
    ]);
    expect(results.filter(({status}) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({status}) => status === 'rejected')).toHaveLength(1);
    expect(results.find(({status}) => status === 'rejected')).toMatchObject({
      reason: {code: 'INSUFFICIENT_CASH'}
    });
  });
});
