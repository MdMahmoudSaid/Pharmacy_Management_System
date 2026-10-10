'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';

import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  renameExpenseCategory,
  type ExpenseCategory
} from './categories';

export type CategoryActionState = ActionResult<ExpenseCategory | null> | undefined;

const value = (data: FormData, key: string) => String(data.get(key) ?? '');
const failure = (error: unknown): Exclude<CategoryActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
  return {ok: false, code: 'INTERNAL_ERROR'};
};
const refresh = (locale: string) => {
  const safe = locale === 'fr' ? 'fr' : 'ar';
  revalidatePath(`/${safe}/expenses`);
  revalidatePath(`/${safe}/settings`);
};

/** Called from the category picker on the expense form. */
export async function quickCreateExpenseCategory(name: string, locale: string): Promise<CategoryActionState> {
  try {
    const category = await createExpenseCategory(await requireSession(), name);
    refresh(locale);
    return {ok: true, data: category};
  } catch (error) {
    return failure(error);
  }
}

export async function createCategoryAction(_state: CategoryActionState, data: FormData): Promise<CategoryActionState> {
  try {
    const category = await createExpenseCategory(await requireSession(), value(data, 'name'));
    refresh(value(data, 'locale'));
    return {ok: true, data: category};
  } catch (error) {
    return failure(error);
  }
}

export async function renameCategoryAction(_state: CategoryActionState, data: FormData): Promise<CategoryActionState> {
  try {
    const category = await renameExpenseCategory(await requireSession(), Number(value(data, 'id')), value(data, 'name'));
    refresh(value(data, 'locale'));
    return {ok: true, data: category};
  } catch (error) {
    return failure(error);
  }
}

export async function deleteCategoryAction(_state: CategoryActionState, data: FormData): Promise<CategoryActionState> {
  try {
    await deleteExpenseCategory(await requireSession(), Number(value(data, 'id')));
    refresh(value(data, 'locale'));
    return {ok: true, data: null};
  } catch (error) {
    return failure(error);
  }
}
