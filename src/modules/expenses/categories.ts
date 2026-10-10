import {and, asc, eq, ne, sql} from 'drizzle-orm';
import {z} from 'zod';

import {db, type DbTransaction} from '@/db/client';
import {expenseCategories} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {appendAudit} from '@/modules/audit/service';
import {authorize, can, type PermissionActor} from '@/modules/permissions/service';

export type ExpenseCategory = {id: number; name: string};

const categoryNameSchema = z.string().trim().min(1).max(80);
const categoryIdSchema = z.number().int().positive();

export const canCreateExpenseCategory = (actor: PermissionActor) =>
  can(actor, 'expenses.create.own', actor.id) || can(actor, 'settings.manage.all');

const sameName = (name: string) => sql`lower(${expenseCategories.name}) = lower(${name})`;

async function assertNameFree(tx: DbTransaction, name: string, exceptId?: number) {
  const [taken] = await tx
    .select({id: expenseCategories.id})
    .from(expenseCategories)
    .where(and(eq(expenseCategories.isActive, true), sameName(name), exceptId ? ne(expenseCategories.id, exceptId) : undefined))
    .limit(1);
  if (taken) throw new AppError('CONFLICT');
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return db
    .select({id: expenseCategories.id, name: expenseCategories.name})
    .from(expenseCategories)
    .where(eq(expenseCategories.isActive, true))
    .orderBy(asc(expenseCategories.name));
}

export async function requireActiveCategory(tx: DbTransaction, id: number) {
  const [category] = await tx
    .select({id: expenseCategories.id})
    .from(expenseCategories)
    .where(and(eq(expenseCategories.id, id), eq(expenseCategories.isActive, true)))
    .limit(1);
  if (!category) throw new AppError('VALIDATION_ERROR');
}

export async function createExpenseCategory(actor: PermissionActor, rawName: string): Promise<ExpenseCategory> {
  if (!canCreateExpenseCategory(actor)) throw new AppError('FORBIDDEN');
  const name = categoryNameSchema.parse(rawName);
  return db.transaction(async (tx) => {
    await assertNameFree(tx, name);
    const [category] = await tx
      .insert(expenseCategories)
      .values({name, createdBy: actor.id})
      .returning({id: expenseCategories.id, name: expenseCategories.name});
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'expense_categories',
      entityId: category.id,
      action: 'CREATE',
      newValues: {name}
    });
    return category;
  });
}

export async function renameExpenseCategory(actor: PermissionActor, rawId: number, rawName: string) {
  authorize(actor, 'settings.manage.all');
  const id = categoryIdSchema.parse(rawId);
  const name = categoryNameSchema.parse(rawName);
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(expenseCategories).where(eq(expenseCategories.id, id)).for('update');
    if (!current || !current.isActive) throw new AppError('NOT_FOUND');
    if (current.name === name) return {id, name};
    await assertNameFree(tx, name, id);
    await tx.update(expenseCategories).set({name, updatedAt: new Date()}).where(eq(expenseCategories.id, id));
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'expense_categories',
      entityId: id,
      action: 'UPDATE',
      oldValues: {name: current.name},
      newValues: {name}
    });
    return {id, name};
  });
}

/** Archives rather than deletes, so past expenses keep their category name. */
export async function deleteExpenseCategory(actor: PermissionActor, rawId: number) {
  authorize(actor, 'settings.manage.all');
  const id = categoryIdSchema.parse(rawId);
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(expenseCategories).where(eq(expenseCategories.id, id)).for('update');
    if (!current || !current.isActive) throw new AppError('NOT_FOUND');
    await tx.update(expenseCategories).set({isActive: false, updatedAt: new Date()}).where(eq(expenseCategories.id, id));
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'expense_categories',
      entityId: id,
      action: 'UPDATE',
      oldValues: {name: current.name, isActive: true},
      newValues: {name: current.name, isActive: false}
    });
  });
}
