import {sql} from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['ADMIN', 'EMPLOYEE']);
export const appLocale = pgEnum('app_locale', ['ar', 'fr']);
export const permissionScope = pgEnum('permission_scope', ['OWN', 'ALL', 'NONE']);

const identity = (name: string) =>
  bigint(name, {mode: 'number'}).generatedAlwaysAsIdentity();
const timestampWithTimeZone = (name: string) =>
  timestamp(name, {withTimezone: true, mode: 'date'});

export const users = pgTable(
  'users',
  {
    id: identity('id').primaryKey(),
    name: text('name').notNull(),
    phoneE164: text('phone_e164').notNull().unique(),
    pinHash: text('pin_hash').notNull(),
    role: userRole('role').notNull(),
    preferredLocale: appLocale('preferred_locale').notNull().default('ar'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: bigint('created_by', {mode: 'number'}).references(
      (): AnyPgColumn => users.id,
      {onDelete: 'restrict'}
    ),
    updatedBy: bigint('updated_by', {mode: 'number'}).references(
      (): AnyPgColumn => users.id,
      {onDelete: 'restrict'}
    ),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow(),
    updatedAt: timestampWithTimeZone('updated_at').notNull().defaultNow()
  },
  (table) => [
    index('users_created_by_idx').on(table.createdBy),
    index('users_updated_by_idx').on(table.updatedBy)
  ]
);

export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: bigint('user_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    expiresAt: timestampWithTimeZone('expires_at').notNull(),
    revokedAt: timestampWithTimeZone('revoked_at'),
    createdAt: timestampWithTimeZone('created_at').notNull().defaultNow()
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_active_user_idx')
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} is null`)
  ]
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: identity('id').primaryKey(),
    phoneFingerprint: text('phone_fingerprint').notNull(),
    originFingerprint: text('origin_fingerprint').notNull(),
    success: boolean('success').notNull(),
    attemptedAt: timestampWithTimeZone('attempted_at').notNull().defaultNow()
  },
  (table) => [
    index('login_attempts_phone_time_idx').on(
      table.phoneFingerprint,
      table.attemptedAt
    ),
    index('login_attempts_origin_time_idx').on(
      table.originFingerprint,
      table.attemptedAt
    )
  ]
);

export const permissions = pgTable('permissions', {
  key: text('key').primaryKey(),
  domain: text('domain').notNull(),
  action: text('action').notNull(),
  scope: permissionScope('scope').notNull().default('NONE')
});

export const userPermissions = pgTable(
  'user_permissions',
  {
    userId: bigint('user_id', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, {onDelete: 'restrict'}),
    grantedBy: bigint('granted_by', {mode: 'number'})
      .notNull()
      .references(() => users.id, {onDelete: 'restrict'}),
    grantedAt: timestampWithTimeZone('granted_at').notNull().defaultNow()
  },
  (table) => [
    primaryKey({columns: [table.userId, table.permissionKey]}),
    index('user_permissions_permission_key_idx').on(table.permissionKey),
    index('user_permissions_granted_by_idx').on(table.grantedBy)
  ]
);
