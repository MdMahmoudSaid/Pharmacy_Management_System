import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, expect, it} from 'vitest';
import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {medicines, sales, stockMovements} from '@/db/schema';
import {createSale} from '@/modules/sales/service';
import {createMedicine, createShift, createUser, resetDatabase} from '../../factories/database';

beforeAll(migrateDatabase);
beforeEach(resetDatabase);

it('allows only one concurrent sale of the last units', async () => {
  const user = await createUser();
  const actor = {id: user.id, role: 'EMPLOYEE' as const, isActive: true, permissions: ['sales.create.own' as const]};
  const shift = await createShift({userId: user.id});
  const medicine = await createMedicine({currentStock: 2});
  const result = await Promise.allSettled([
    createSale(actor, {shiftId: shift.id, idempotencyKey: 'concurrent-a', items: [{medicineId: medicine.id, quantity: 2}]}),
    createSale(actor, {shiftId: shift.id, idempotencyKey: 'concurrent-b', items: [{medicineId: medicine.id, quantity: 2}]})
  ]);
  const [stored] = await db.select().from(medicines).where(eq(medicines.id, medicine.id));
  expect(result.filter(({status}) => status === 'fulfilled')).toHaveLength(1);
  expect(result.filter(({status}) => status === 'rejected')).toHaveLength(1);
  expect(stored.currentStock).toBe(0);
  expect(await db.select().from(sales)).toHaveLength(1);
  expect(await db.select().from(stockMovements)).toHaveLength(1);
});
