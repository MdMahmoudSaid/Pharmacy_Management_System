import {sql} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {expenses, saleItems, sales} from '@/db/schema';
import {
  createMedicine,
  createShift,
  createUser,
  resetDatabase
} from '../../factories/database';

describe('database schema constraints', () => {
  beforeAll(async () => {
    await migrateDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it('enforces one open shift per user and non-negative stock', async () => {
    const user = await createUser();
    await createShift({userId: user.id, status: 'OPEN'});

    await expect(
      createShift({userId: user.id, status: 'OPEN'})
    ).rejects.toThrow();
    await expect(createMedicine({currentStock: -1})).rejects.toThrow();
  });

  it('requires normalized phones to be unique', async () => {
    await createUser({phoneE164: '+22221234567'});

    await expect(
      createUser({phoneE164: '+22221234567'})
    ).rejects.toThrow();
  });

  it('deduplicates sale requests per operator', async () => {
    const user = await createUser();
    const shift = await createShift({userId: user.id});
    const sale = {
      saleNumber: 'SALE-001',
      shiftId: shift.id,
      operatorId: user.id,
      total: '10.00',
      status: 'COMPLETED' as const,
      idempotencyKey: 'same-key'
    };

    await db.insert(sales).values(sale);
    await expect(
      db.insert(sales).values({...sale, saleNumber: 'SALE-002'})
    ).rejects.toThrow();
  });

  it('rejects non-positive sale quantities and expenses', async () => {
    const user = await createUser();
    const shift = await createShift({userId: user.id});
    const medicine = await createMedicine();
    const [sale] = await db
      .insert(sales)
      .values({
        saleNumber: 'SALE-003',
        shiftId: shift.id,
        operatorId: user.id,
        total: '0.00',
        status: 'COMPLETED',
        idempotencyKey: 'quantity-check'
      })
      .returning();

    await expect(
      db.insert(saleItems).values({
        saleId: sale.id,
        medicineId: medicine.id,
        quantity: 0,
        unitPrice: '10.00',
        lineTotal: '0.00'
      })
    ).rejects.toThrow();

    await expect(
      db.insert(expenses).values({
        amount: '0.00',
        description: 'Invalid expense',
        shiftId: shift.id,
        operatorId: user.id,
        status: 'ACTIVE',
        occurredAt: new Date()
      })
    ).rejects.toThrow();
  });

  it('indexes every foreign-key column', async () => {
    const result = await db.execute<{table_name: string; column_name: string}>(sql`
      select
        c.conrelid::regclass::text as table_name,
        a.attname as column_name
      from pg_constraint c
      cross join lateral unnest(c.conkey) as key(attnum)
      join pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = key.attnum
      where c.contype = 'f'
        and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1
          from pg_index i
          where i.indrelid = c.conrelid
            and key.attnum = any(i.indkey)
        )
      order by table_name, column_name
    `);

    expect(result.rows).toEqual([]);
  });

  it('stores timestamps with time zone and money as exact numeric values', async () => {
    const result = await db.execute<{column_name: string; data_type: string}>(sql`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'sales' and column_name = 'total')
          or (table_name = 'users' and column_name = 'created_at')
        )
      order by column_name
    `);

    expect(result.rows).toEqual([
      {column_name: 'created_at', data_type: 'timestamp with time zone'},
      {column_name: 'total', data_type: 'numeric'}
    ]);
  });

  it('provides supplier, costing, and capital ledger storage', async () => {
    const tables = await db.execute<{table_name: string}>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('suppliers', 'supplier_payments', 'capital_movements')
      order by table_name
    `);
    expect(tables.rows).toEqual([
      {table_name: 'capital_movements'},
      {table_name: 'supplier_payments'},
      {table_name: 'suppliers'}
    ]);

    const columns = await db.execute<{table_name: string; column_name: string}>(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'medicines' and column_name = 'average_cost')
          or (table_name = 'sale_items' and column_name = 'unit_cost')
          or (table_name = 'stock_receipts' and column_name in ('supplier_id', 'unit_cost', 'total_cost'))
        )
      order by table_name, column_name
    `);
    expect(columns.rows).toEqual([
      {table_name: 'medicines', column_name: 'average_cost'},
      {table_name: 'sale_items', column_name: 'unit_cost'},
      {table_name: 'stock_receipts', column_name: 'supplier_id'},
      {table_name: 'stock_receipts', column_name: 'total_cost'},
      {table_name: 'stock_receipts', column_name: 'unit_cost'}
    ]);
  });

  it('stores owner withdrawal allocation as exact profit and capital portions', async () => {
    const columns = await db.execute<{column_name: string; data_type: string}>(sql`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'capital_movements'
        and column_name in ('profit_portion', 'capital_portion')
      order by column_name
    `);

    expect(columns.rows).toEqual([
      {column_name: 'capital_portion', data_type: 'numeric'},
      {column_name: 'profit_portion', data_type: 'numeric'}
    ]);
  });
});
