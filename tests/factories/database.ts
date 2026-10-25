import {sql} from 'drizzle-orm';

import {db} from '@/db/client';
import {medicines, shifts, users} from '@/db/schema';

let sequence = 0;

export async function resetDatabase() {
  await db.execute(sql`
    truncate table
      audit_logs,
      capital_movements,
      sale_items,
      stock_movements,
      stock_receipts,
      supplier_payments,
      expenses,
      expense_categories,
      sales,
      shifts,
      user_permissions,
      sessions,
      login_attempts,
      medicines,
      suppliers,
      permissions,
      settings,
      users
    restart identity cascade
  `);
}

export async function createUser(
  overrides: Partial<typeof users.$inferInsert> = {}
) {
  sequence += 1;
  const [user] = await db
    .insert(users)
    .values({
      name: `Test User ${sequence}`,
      phoneE164: `+2222${String(sequence).padStart(7, '0')}`,
      pinHash: 'test-hash',
      role: 'EMPLOYEE',
      ...overrides
    })
    .returning();
  return user;
}

export async function createShift(
  input: Pick<typeof shifts.$inferInsert, 'userId'> &
    Partial<typeof shifts.$inferInsert>
) {
  const [shift] = await db
    .insert(shifts)
    .values({status: 'OPEN', ...input})
    .returning();
  return shift;
}

export async function createMedicine(
  overrides: Partial<typeof medicines.$inferInsert> = {}
) {
  sequence += 1;
  const [medicine] = await db
    .insert(medicines)
    .values({
      name: `Medicine ${sequence}`,
      sellingPrice: '10.00',
      currentStock: 0,
      ...overrides
    })
    .returning();
  return medicine;
}
