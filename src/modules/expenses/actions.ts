'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';

import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {cancelExpense, correctExpense, createExpense} from './service';

export type ExpenseActionState = ActionResult<{id: number}> | undefined;
const value = (data: FormData, key: string) => String(data.get(key) ?? '');
const locale = (data: FormData) => (value(data, 'locale') === 'fr' ? 'fr' : 'ar');
const refresh = (data: FormData) => revalidatePath(`/${locale(data)}/expenses`);
const categoryId = (data: FormData) => {
  const id = Number(value(data, 'categoryId'));
  if (!Number.isInteger(id) || id <= 0) throw new AppError('VALIDATION_ERROR');
  return id;
};
const failure = (error: unknown): Exclude<ExpenseActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
  return {ok: false, code: 'INTERNAL_ERROR'};
};

export async function createExpenseAction(
  _state: ExpenseActionState,
  data: FormData
): Promise<ExpenseActionState> {
  try {
    const expense = await createExpense(await requireSession(), {
      shiftId: Number(value(data, 'shiftId')),
      amount: value(data, 'amount'),
      categoryId: categoryId(data),
      description: value(data, 'description')
    });
    refresh(data);
    return {ok: true, data: {id: expense.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function correctExpenseAction(
  _state: ExpenseActionState,
  data: FormData
): Promise<ExpenseActionState> {
  try {
    const expense = await correctExpense(
      await requireSession(),
      Number(value(data, 'id')),
      {
        amount: value(data, 'amount'),
        categoryId: categoryId(data),
        description: value(data, 'description'),
        reason: value(data, 'reason')
      }
    );
    refresh(data);
    return {ok: true, data: {id: expense.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function cancelExpenseAction(
  _state: ExpenseActionState,
  data: FormData
): Promise<ExpenseActionState> {
  try {
    const expense = await cancelExpense(
      await requireSession(),
      Number(value(data, 'id')),
      value(data, 'reason')
    );
    refresh(data);
    return {ok: true, data: {id: expense.id}};
  } catch (error) {
    return failure(error);
  }
}
