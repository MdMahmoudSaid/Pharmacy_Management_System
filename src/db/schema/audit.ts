import {sql} from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

import {appLocale, users} from './auth';
import {shifts} from './operations';

export const auditAction = pgEnum('audit_action', [
  'CREATE',
  'UPDATE',
  'CORRECT',
  'CANCEL',
  'ARCHIVE',
  'RESTORE',
  'REOPEN',
  'RESET_PIN',
  'PERMISSION_CHANGE',
  'PRICE_OVERRIDE'
]);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint('id', {mode: 'number'}).generatedAlwaysAsIdentity().primaryKey(),
    actorId: bigint('actor_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    entityType: text('entity_type').notNull(),
    entityId: bigint('entity_id', {mode: 'number'}).notNull(),
    action: auditAction('action').notNull(),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    reason: text('reason'),
    relatedShiftId: bigint('related_shift_id', {mode: 'number'}).references(
      () => shifts.id,
      {onDelete: 'restrict'}
    ),
    relatedTransactionType: text('related_transaction_type'),
    relatedTransactionId: bigint('related_transaction_id', {mode: 'number'}),
    createdAt: timestamp('created_at', {withTimezone: true, mode: 'date'})
      .notNull()
      .defaultNow()
  },
  (table) => [
    check(
      'audit_sensitive_reason_required',
      sql`${table.action} not in ('CORRECT', 'CANCEL', 'ARCHIVE', 'RESTORE', 'REOPEN', 'RESET_PIN', 'PERMISSION_CHANGE', 'PRICE_OVERRIDE') or length(trim(${table.reason})) > 0`
    ),
    index('audit_logs_actor_id_idx').on(table.actorId),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_action_created_at_idx').on(table.action, table.createdAt),
    index('audit_logs_related_shift_id_idx').on(table.relatedShiftId)
  ]
);

export const settings = pgTable(
  'settings',
  {
    key: text('key').primaryKey().default('default'),
    pharmacyName: text('pharmacy_name').notNull().default('Pharmacy'),
    defaultLocale: appLocale('default_locale').notNull().default('ar'),
    receiptPreferences: jsonb('receipt_preferences')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    updatedBy: bigint('updated_by', {mode: 'number'}).references(() => users.id, {
      onDelete: 'restrict'
    }),
    updatedAt: timestamp('updated_at', {withTimezone: true, mode: 'date'})
      .notNull()
      .defaultNow()
  },
  (table) => [index('settings_updated_by_idx').on(table.updatedBy)]
);
