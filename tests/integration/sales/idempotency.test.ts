import {beforeAll, beforeEach, expect, it} from 'vitest';
import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {sales, stockMovements} from '@/db/schema';
import {createSale} from '@/modules/sales/service';
import {createMedicine, createShift, createUser, resetDatabase} from '../../factories/database';

beforeAll(migrateDatabase);
beforeEach(resetDatabase);

it('returns the committed sale for a repeated idempotency key', async () => {
  const user = await createUser();
  const actor = {id: user.id, role: 'EMPLOYEE' as const, isActive: true, permissions: ['sales.create.own' as const]};
  const shift = await createShift({userId: user.id});
  const medicine = await createMedicine({currentStock: 5});
  const input = {shiftId: shift.id, idempotencyKey: 'same-sale', items: [{medicineId: medicine.id, quantity: 2}]};
  const first = await createSale(actor, input);
  const second = await createSale(actor, input);
  expect(second.id).toBe(first.id);
  expect(await db.select().from(sales)).toHaveLength(1);
  expect(await db.select().from(stockMovements)).toHaveLength(1);
});
