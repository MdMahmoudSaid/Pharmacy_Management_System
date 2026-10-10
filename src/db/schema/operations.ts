import {sql} from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import {users} from './auth';
import {medicines} from './catalog';

export const shiftStatus = pgEnum('shift_status', ['OPEN', 'CLOSED']);
export const activeStatus = pgEnum('active_status', ['ACTIVE', 'CANCELLED']);
export const saleStatus = pgEnum('sale_status', ['COMPLETED', 'CANCELLED']);
export const stockMovementType = pgEnum('stock_movement_type', [
  'STOCK_RECEIVED',
  'SALE',
  'SALE_CANCELLATION',
  'SALE_CORRECTION',
  'STOCK_RECEIPT_CORRECTION',
  'MANUAL_CORRECTION',
  'OTHER_ADJUSTMENT'
]);
export const relatedEntityType = pgEnum('related_entity_type', [
  'STOCK_RECEIPT',
  'SALE',
  'MEDICINE'
]);

const identity = (name: string) =>
  bigint(name, {mode: 'number'}).generatedAlwaysAsIdentity();
const timestampWithTimeZone = (name: string) =>
  timestamp(name, {withTimezone: true, mode: 'date'});

export const shifts = pgTable(
  'shifts',
  {
    id: identity('id').primaryKey(),
    userId: bigint('user_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    openedAt: timestampWithTimeZone('opened_at').notNull().defaultNow(),
    closedAt: timestampWithTimeZone('closed_at'),
    status: shiftStatus('status').notNull().default('OPEN'),
    createdBy: bigint('created_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    updatedBy: bigint('updated_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow(),
    updatedAt: timestampWithTimeZone('updated_at').notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('shifts_one_open_per_user')
      .on(table.userId)
      .where(sql`${table.status} = 'OPEN'`),
    index('shifts_user_id_idx').on(table.userId),
    index('shifts_status_opened_at_idx').on(table.status, table.openedAt),
    index('shifts_created_by_idx').on(table.createdBy),
    index('shifts_updated_by_idx').on(table.updatedBy),
    check(
      'shifts_closed_state_consistent',
      sql`(${table.status} = 'OPEN' and ${table.closedAt} is null) or (${table.status} = 'CLOSED' and ${table.closedAt} is not null)`
    )
  ]
);

export const stockReceipts = pgTable(
  'stock_receipts',
  {
    id: identity('id').primaryKey(),
    medicineId: bigint('medicine_id', {mode: 'number'})
      .notNull()
      .references(() => medicines.id, {onDelete: 'restrict'}),
    quantity: integer('quantity').notNull(),
    status: activeStatus('status').notNull().default('ACTIVE'),
    shiftId: bigint('shift_id', {mode: 'number'})
      .notNull()
      .references(() => shifts.id, {onDelete: 'restrict'}),
    operatorId: bigint('operator_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    note: text('note'),
    occurredAt: timestampWithTimeZone('occurred_at').notNull().defaultNow(),
    createdBy: bigint('created_by', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    updatedBy: bigint('updated_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow(),
    updatedAt: timestampWithTimeZone('updated_at').notNull().defaultNow()
  },
  (table) => [
    check('stock_receipts_quantity_positive', sql`${table.quantity} > 0`),
    index('stock_receipts_medicine_id_idx').on(table.medicineId),
    index('stock_receipts_shift_id_idx').on(table.shiftId),
    index('stock_receipts_operator_id_idx').on(table.operatorId),
    index('stock_receipts_created_by_idx').on(table.createdBy),
    index('stock_receipts_updated_by_idx').on(table.updatedBy),
    index('stock_receipts_status_occurred_at_idx').on(
      table.status,
      table.occurredAt
    )
  ]
);

export const sales = pgTable(
  'sales',
  {
    id: identity('id').primaryKey(),
    saleNumber: text('sale_number').notNull().unique(),
    shiftId: bigint('shift_id', {mode: 'number'})
      .notNull()
      .references(() => shifts.id, {onDelete: 'restrict'}),
    operatorId: bigint('operator_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    total: numeric('total', {precision: 14, scale: 2}).notNull(),
    status: saleStatus('status').notNull().default('COMPLETED'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdBy: bigint('created_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    updatedBy: bigint('updated_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow(),
    updatedAt: timestampWithTimeZone('updated_at').notNull().defaultNow()
  },
  (table) => [
    check('sales_total_non_negative', sql`${table.total} >= 0`),
    uniqueIndex('sales_operator_idempotency_unique').on(
      table.operatorId,
      table.idempotencyKey
    ),
    index('sales_shift_id_idx').on(table.shiftId),
    index('sales_operator_id_idx').on(table.operatorId),
    index('sales_created_by_idx').on(table.createdBy),
    index('sales_updated_by_idx').on(table.updatedBy),
    index('sales_status_created_at_idx').on(table.status, table.createdAt)
  ]
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: identity('id').primaryKey(),
    saleId: bigint('sale_id', {mode: 'number'})
      .notNull()
      .references(() => sales.id, {onDelete: 'restrict'}),
    medicineId: bigint('medicine_id', {mode: 'number'})
      .notNull()
      .references(() => medicines.id, {onDelete: 'restrict'}),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', {precision: 14, scale: 2}).notNull(),
    lineTotal: numeric('line_total', {precision: 14, scale: 2}).notNull()
  },
  (table) => [
    check('sale_items_quantity_positive', sql`${table.quantity} > 0`),
    check('sale_items_unit_price_positive', sql`${table.unitPrice} > 0`),
    check('sale_items_line_total_positive', sql`${table.lineTotal} > 0`),
    index('sale_items_sale_id_idx').on(table.saleId),
    index('sale_items_medicine_id_idx').on(table.medicineId)
  ]
);

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: identity('id').primaryKey(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: bigint('created_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow(),
    updatedAt: timestampWithTimeZone('updated_at').notNull().defaultNow()
  },
  (table) => [
    check('expense_categories_name_non_empty', sql`length(trim(${table.name})) > 0`),
    uniqueIndex('expense_categories_active_name_unique')
      .on(sql`lower(${table.name})`)
      .where(sql`${table.isActive}`),
    index('expense_categories_created_by_idx').on(table.createdBy)
  ]
);

export const expenses = pgTable(
  'expenses',
  {
    id: identity('id').primaryKey(),
    amount: numeric('amount', {precision: 14, scale: 2}).notNull(),
    categoryId: bigint('category_id', {mode: 'number'}).references(() => expenseCategories.id, {
      onDelete: 'restrict'
    }),
    description: text('description'),
    shiftId: bigint('shift_id', {mode: 'number'})
      .notNull()
      .references(() => shifts.id, {onDelete: 'restrict'}),
    operatorId: bigint('operator_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    status: activeStatus('status').notNull().default('ACTIVE'),
    occurredAt: timestampWithTimeZone('occurred_at').notNull().defaultNow(),
    createdBy: bigint('created_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    updatedBy: bigint('updated_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow(),
    updatedAt: timestampWithTimeZone('updated_at').notNull().defaultNow()
  },
  (table) => [
    check('expenses_amount_positive', sql`${table.amount} > 0`),
    check(
      'expenses_category_or_description',
      sql`${table.categoryId} is not null or length(trim(coalesce(${table.description}, ''))) > 0`
    ),
    index('expenses_category_id_idx').on(table.categoryId),
    index('expenses_shift_id_idx').on(table.shiftId),
    index('expenses_operator_id_idx').on(table.operatorId),
    index('expenses_created_by_idx').on(table.createdBy),
    index('expenses_updated_by_idx').on(table.updatedBy),
    index('expenses_status_occurred_at_idx').on(table.status, table.occurredAt)
  ]
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: identity('id').primaryKey(),
    medicineId: bigint('medicine_id', {mode: 'number'})
      .notNull()
      .references(() => medicines.id, {onDelete: 'restrict'}),
    type: stockMovementType('type').notNull(),
    quantityBefore: integer('quantity_before').notNull(),
    quantityChange: integer('quantity_change').notNull(),
    quantityAfter: integer('quantity_after').notNull(),
    relatedEntityType: relatedEntityType('related_entity_type').notNull(),
    relatedEntityId: bigint('related_entity_id', {mode: 'number'}).notNull(),
    shiftId: bigint('shift_id', {mode: 'number'}).references(() => shifts.id, {
      onDelete: 'restrict'
    }),
    actorId: bigint('actor_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    note: text('note'),
    reason: text('reason'),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow()
  },
  (table) => [
    check('stock_movements_before_non_negative', sql`${table.quantityBefore} >= 0`),
    check('stock_movements_after_non_negative', sql`${table.quantityAfter} >= 0`),
    check(
      'stock_movements_math_consistent',
      sql`${table.quantityAfter} = ${table.quantityBefore} + ${table.quantityChange}`
    ),
    index('stock_movements_medicine_id_idx').on(table.medicineId),
    index('stock_movements_shift_id_idx').on(table.shiftId),
    index('stock_movements_actor_id_idx').on(table.actorId),
    index('stock_movements_type_created_at_idx').on(table.type, table.createdAt),
    index('stock_movements_related_idx').on(
      table.relatedEntityType,
      table.relatedEntityId
    )
  ]
);
