import {sql} from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

import {users} from './auth';
import {financialRecordStatus} from './suppliers';

const identity = (name: string) =>
  bigint(name, {mode: 'number'}).generatedAlwaysAsIdentity();
const timestampWithTimeZone = (name: string) =>
  timestamp(name, {withTimezone: true, mode: 'date'});

export const capitalMovementType = pgEnum('capital_movement_type', [
  'ADDITION',
  'WITHDRAWAL'
]);

export const capitalMovements = pgTable(
  'capital_movements',
  {
    id: identity('id').primaryKey(),
    type: capitalMovementType('type').notNull(),
    amount: numeric('amount', {precision: 14, scale: 2}).notNull(),
    profitPortion: numeric('profit_portion', {precision: 14, scale: 2})
      .notNull()
      .default('0.00'),
    capitalPortion: numeric('capital_portion', {precision: 14, scale: 2})
      .notNull()
      .default('0.00'),
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
    check('capital_movements_amount_positive', sql`${table.amount} > 0`),
    check(
      'capital_movements_allocation_consistent',
      sql`(${table.type} = 'ADDITION' and ${table.profitPortion} = 0 and ${table.capitalPortion} = 0) or (${table.type} = 'WITHDRAWAL' and ${table.profitPortion} >= 0 and ${table.capitalPortion} >= 0 and ${table.profitPortion} + ${table.capitalPortion} = ${table.amount})`
    ),
    check(
      'capital_movements_void_state_consistent',
      sql`(${table.status} = 'ACTIVE' and ${table.voidedAt} is null and ${table.voidedBy} is null) or (${table.status} = 'VOIDED' and ${table.voidedAt} is not null and ${table.voidedBy} is not null and length(trim(coalesce(${table.voidReason}, ''))) > 0)`
    ),
    index('capital_movements_operator_id_idx').on(table.operatorId),
    index('capital_movements_voided_by_idx').on(table.voidedBy),
    index('capital_movements_status_occurred_at_idx').on(table.status, table.occurredAt)
  ]
);
