'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';

import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {recordCapitalMovement} from './service';

export type AccountActionState = ActionResult<{id: number}> | undefined;
const text = (data: FormData, key: string) => String(data.get(key) ?? '');
const failure = (error: unknown): Exclude<AccountActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
  return {ok: false, code: 'INTERNAL_ERROR'};
};

export async function recordCapitalMovementAction(
  _state: AccountActionState,
  data: FormData
): Promise<AccountActionState> {
  try {
    const locale = text(data, 'locale') === 'fr' ? 'fr' : 'ar';
    const movement = await recordCapitalMovement(await requireSession(), {
      type: text(data, 'type') as 'ADDITION' | 'WITHDRAWAL',
      amount: text(data, 'amount'),
      source: (text(data, 'source') || undefined) as 'PROFIT' | 'CAPITAL' | undefined,
      allowCapitalFallback: text(data, 'allowCapitalFallback') === 'true',
      note: text(data, 'note') || undefined,
      occurredAt: text(data, 'occurredAt')
        ? new Date(`${text(data, 'occurredAt')}T12:00:00Z`)
        : undefined
    });
    revalidatePath(`/${locale}/accounts`);
    return {ok: true, data: {id: movement.id}};
  } catch (error) {
    return failure(error);
  }
}
