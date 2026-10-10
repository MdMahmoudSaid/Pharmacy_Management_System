import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {sales} from '@/db/schema';
import {nouakchottRange} from '@/lib/time';
import type {PermissionActor} from '@/modules/permissions/service';
import {getReportData} from '@/modules/reports/queries';
import {createSale} from '@/modules/sales/service';
import {createMedicine, createShift, createUser, resetDatabase} from '../../factories/database';

describe('report date boundaries', () => {
  let admin: PermissionActor;
  beforeAll(migrateDatabase);
  beforeEach(async () => {
    await resetDatabase();
    const user = await createUser({role: 'ADMIN'});
    admin = {id: user.id, role: 'ADMIN', isActive: true, permissions: []};
  });

  it('includes the lower boundary and excludes the adjacent upper boundary', async () => {
    const shift = await createShift({userId: admin.id});
    const medicine = await createMedicine({currentStock: 10, sellingPrice: '10.00'});
    const first = await createSale(admin, {
      shiftId: shift.id,
      idempotencyKey: 'boundary-first',
      items: [{medicineId: medicine.id, quantity: 1}]
    });
    const adjacent = await createSale(admin, {
      shiftId: shift.id,
      idempotencyKey: 'boundary-adjacent',
      items: [{medicineId: medicine.id, quantity: 1}]
    });
    const range = nouakchottRange('today', new Date('2026-10-10T12:00:00Z'));
    await db.update(sales).set({createdAt: range.from}).where(eq(sales.id, first.id));
    await db.update(sales).set({createdAt: range.to}).where(eq(sales.id, adjacent.id));

    const report = await getReportData(admin, range);
    expect(report.sales.map(({id}) => id)).toEqual([first.id]);
    expect(report.summary.salesTotal).toBe('10.00');
  });
});
