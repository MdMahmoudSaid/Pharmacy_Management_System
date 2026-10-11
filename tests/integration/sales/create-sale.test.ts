import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {medicines, saleItems, sales, stockMovements} from '@/db/schema';
import type {PermissionActor} from '@/modules/permissions/service';
import {createSale} from '@/modules/sales/service';
import {createMedicine, createShift, createUser, resetDatabase} from '../../factories/database';

describe('sale creation', () => {
  let employee: PermissionActor;
  let shiftId: number;

  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser();
    employee = {
      id: user.id,
      role: 'EMPLOYEE',
      isActive: true,
      permissions: ['sales.create.own']
    };
    shiftId = (await createShift({userId: user.id})).id;
  });

  it('creates one sale and decrements stock atomically', async () => {
    const medicine = await createMedicine({currentStock: 20, sellingPrice: '25.50'});
    const sale = await createSale(employee, {
      shiftId,
      idempotencyKey: 'normal-sale',
      items: [{medicineId: medicine.id, quantity: 3}]
    });
    const [storedMedicine] = await db
      .select()
      .from(medicines)
      .where(eq(medicines.id, medicine.id));
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.relatedEntityId, sale.id));

    expect(sale.total).toBe('76.50');
    expect(storedMedicine.currentStock).toBe(17);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      quantityBefore: 20,
      quantityChange: -3,
      quantityAfter: 17,
      type: 'SALE'
    });
  });

  it.each([
    {name: 'empty cart', items: []},
    {name: 'zero quantity', items: [{medicineId: 1, quantity: 0}]},
    {name: 'decimal quantity', items: [{medicineId: 1, quantity: 1.5}]}
  ])('rejects $name', async ({items}) => {
    await expect(
      createSale(employee, {shiftId, idempotencyKey: `invalid-${items.length}`, items})
    ).rejects.toBeDefined();
  });

  it('rejects inactive medicine and missing active shift', async () => {
    const medicine = await createMedicine({currentStock: 2, isActive: false});
    await expect(
      createSale(employee, {
        shiftId,
        idempotencyKey: 'inactive',
        items: [{medicineId: medicine.id, quantity: 1}]
      })
    ).rejects.toMatchObject({code: 'CONFLICT'});
    const {shifts} = await import('@/db/schema');
    await db
      .update(shifts)
      .set({status: 'CLOSED', closedAt: new Date()})
      .where(eq(shifts.id, shiftId));
    await expect(
      createSale(employee, {
        shiftId,
        idempotencyKey: 'no-shift',
        items: [{medicineId: medicine.id, quantity: 1}]
      })
    ).rejects.toMatchObject({code: 'SHIFT_REQUIRED'});
  });

  it('requires permission but no reason for a price override', async () => {
    const medicine = await createMedicine({currentStock: 2, sellingPrice: '10.00'});
    const input = {
      shiftId,
      idempotencyKey: 'override',
      items: [{medicineId: medicine.id, quantity: 1, unitPrice: '9.00', overrideReason: 'Remise'}]
    };
    await expect(createSale(employee, input)).rejects.toMatchObject({code: 'FORBIDDEN'});
    employee = {...employee, permissions: ['sales.create.own', 'sales.price_override.all']};
    await expect(
      createSale(employee, {
        ...input,
        idempotencyKey: 'override-no-reason',
        items: [{medicineId: medicine.id, quantity: 1, unitPrice: '9.00'}]
      })
    ).resolves.toMatchObject({total: '9.00'});
    const sale = await createSale(employee, input);
    expect(sale.total).toBe('9.00');
  });

  it('rolls back every write on insufficient stock', async () => {
    const first = await createMedicine({currentStock: 4});
    const second = await createMedicine({currentStock: 1});
    await expect(
      createSale(employee, {
        shiftId,
        idempotencyKey: 'oversell',
        items: [
          {medicineId: second.id, quantity: 2},
          {medicineId: first.id, quantity: 1}
        ]
      })
    ).rejects.toMatchObject({code: 'INSUFFICIENT_STOCK'});
    expect(await db.select().from(sales)).toEqual([]);
    expect(await db.select().from(saleItems)).toEqual([]);
    expect(await db.select().from(stockMovements)).toEqual([]);
    expect((await db.select().from(medicines)).map(({currentStock}) => currentStock)).toEqual([4, 1]);
  });
});
