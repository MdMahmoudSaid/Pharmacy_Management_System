import {sql} from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import {users} from './auth';

const identity = (name: string) =>
  bigint(name, {mode: 'number'}).generatedAlwaysAsIdentity();
const timestampWithTimeZone = (name: string) =>
  timestamp(name, {withTimezone: true, mode: 'date'});

export const financialRecordStatus = pgEnum('financial_record_status', [
  'ACTIVE',
  'VOIDED'
]);

export const suppliers = pgTable(
  'suppliers',
  {
    id: identity('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone'),
    contactPerson: text('contact_person'),
    address: text('address'),
    note: text('note'),
    isActive: boolean('is_active').notNull().default(true),
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
    check('suppliers_name_non_empty', sql`length(trim(${table.name})) > 0`),
    uniqueIndex('suppliers_active_name_unique')
      .on(sql`lower(trim(${table.name}))`)
      .where(sql`${table.isActive}`),
    index('suppliers_created_by_idx').on(table.createdBy),
    index('suppliers_updated_by_idx').on(table.updatedBy),
    index('suppliers_active_name_idx').on(table.isActive, table.name)
  ]
);

export const supplierPayments = pgTable(
  'supplier_payments',
  {
    id: identity('id').primaryKey(),
    supplierId: bigint('supplier_id', {mode: 'number'})
      .notNull()
      .references(() => suppliers.id, {onDelete: 'restrict'}),
    amount: numeric('amount', {precision: 14, scale: 2}).notNull(),
    reference: text('reference'),
    note: text('note'),
    status: financialRecordStatus('status').notNull().default('ACTIVE'),
    occurredAt: timestampWithTimeZone('occurred_at').notNull().defaultNow(),
    operatorId: bigint('operator_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    voidedAt: timestampWithTimeZone('voided_at'),
    voidedBy: bigint('voided_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    voidReason: text('void_reason'),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow()
  },
  (table) => [
    check('supplier_payments_amount_positive', sql`${table.amount} > 0`),
    check(
      'supplier_payments_void_state_consistent',
      sql`(${table.status} = 'ACTIVE' and ${table.voidedAt} is null and ${table.voidedBy} is null) or (${table.status} = 'VOIDED' and ${table.voidedAt} is not null and ${table.voidedBy} is not null and length(trim(coalesce(${table.voidReason}, ''))) > 0)`
    ),
    index('supplier_payments_supplier_id_idx').on(table.supplierId),
    index('supplier_payments_operator_id_idx').on(table.operatorId),
    index('supplier_payments_voided_by_idx').on(table.voidedBy),
    index('supplier_payments_status_occurred_at_idx').on(table.status, table.occurredAt)
  ]
);

// A debt owed to a supplier that did not come from a stock receipt here, e.g. the balance carried over
// from before the pharmacy started using the app. It raises the supplier balance but moves no cash.
export const supplierDebts = pgTable(
  'supplier_debts',
  {
    id: identity('id').primaryKey(),
    supplierId: bigint('supplier_id', {mode: 'number'})
      .notNull()
      .references(() => suppliers.id, {onDelete: 'restrict'}),
    amount: numeric('amount', {precision: 14, scale: 2}).notNull(),
    note: text('note'),
    status: financialRecordStatus('status').notNull().default('ACTIVE'),
    occurredAt: timestampWithTimeZone('occurred_at').notNull().defaultNow(),
    operatorId: bigint('operator_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    voidedAt: timestampWithTimeZone('voided_at'),
    voidedBy: bigint('voided_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    voidReason: text('void_reason'),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow()
  },
  (table) => [
    check('supplier_debts_amount_positive', sql`${table.amount} > 0`),
    check(
      'supplier_debts_void_state_consistent',
      sql`(${table.status} = 'ACTIVE' and ${table.voidedAt} is null and ${table.voidedBy} is null) or (${table.status} = 'VOIDED' and ${table.voidedAt} is not null and ${table.voidedBy} is not null and length(trim(coalesce(${table.voidReason}, ''))) > 0)`
    ),
    index('supplier_debts_supplier_id_idx').on(table.supplierId),
    index('supplier_debts_operator_id_idx').on(table.operatorId),
    index('supplier_debts_voided_by_idx').on(table.voidedBy),
    index('supplier_debts_status_occurred_at_idx').on(table.status, table.occurredAt)
  ]
);
