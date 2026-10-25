import {sql} from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import {users} from './auth';

export const medicines = pgTable(
  'medicines',
  {
    id: bigint('id', {mode: 'number'}).generatedAlwaysAsIdentity().primaryKey(),
    name: text('name').notNull(),
    code: text('code'),
    sellingPrice: numeric('selling_price', {precision: 14, scale: 2}).notNull(),
    averageCost: numeric('average_cost', {precision: 14, scale: 2})
      .notNull()
      .default('0.00'),
    currentStock: integer('current_stock').notNull().default(0),
    minStock: integer('min_stock').notNull().default(5),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: bigint('created_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    updatedBy: bigint('updated_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    createdAt: timestamp('created_at', {withTimezone: true, mode: 'date'})
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true, mode: 'date'})
      .notNull()
      .defaultNow()
  },
  (table) => [
    check('medicines_price_positive', sql`${table.sellingPrice} > 0`),
    check('medicines_average_cost_non_negative', sql`${table.averageCost} >= 0`),
    check('medicines_stock_non_negative', sql`${table.currentStock} >= 0`),
    check('medicines_min_stock_non_negative', sql`${table.minStock} >= 0`),
    index('medicines_name_idx').on(table.name),
    uniqueIndex('medicines_code_unique_idx')
      .on(table.code)
      .where(sql`${table.code} is not null`),
    index('medicines_created_by_idx').on(table.createdBy),
    index('medicines_updated_by_idx').on(table.updatedBy)
  ]
);
