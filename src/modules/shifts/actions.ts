'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';

import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {closeShift, correctShift, openShift, reopenShift} from './service';

export type ShiftActionState = ActionResult<{id: number}> | undefined;
const value = (data: FormData, key: string) => String(data.get(key) ?? '');
const locale = (data: FormData) => (value(data, 'locale') === 'fr' ? 'fr' : 'ar');
const refresh = (data: FormData) => revalidatePath(`/${locale(data)}/shifts`);

const failure = (error: unknown): Exclude<ShiftActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
  return {ok: false, code: 'INTERNAL_ERROR'};
};

export async function openShiftAction(
  _previous: ShiftActionState,
  data: FormData
): Promise<ShiftActionState> {
  try {
    const shift = await openShift(await requireSession());
    refresh(data);
    return {ok: true, data: {id: shift.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function closeShiftAction(
  _previous: ShiftActionState,
  data: FormData
): Promise<ShiftActionState> {
  try {
    const shift = await closeShift(
      await requireSession(),
      Number(value(data, 'id'))
    );
    refresh(data);
    return {ok: true, data: {id: shift.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function correctShiftAction(
  _previous: ShiftActionState,
  data: FormData
): Promise<ShiftActionState> {
  try {
    const closedAt = value(data, 'closedAt');
    const shift = await correctShift(await requireSession(), {
      shiftId: Number(value(data, 'id')),
      openedAt: new Date(value(data, 'openedAt')),
      closedAt: closedAt ? new Date(closedAt) : null,
      reason: value(data, 'reason')
    });
    refresh(data);
    return {ok: true, data: {id: shift.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function reopenShiftAction(
  _previous: ShiftActionState,
  data: FormData
): Promise<ShiftActionState> {
  try {
    const shift = await reopenShift(await requireSession(), {
      shiftId: Number(value(data, 'id')),
      reason: value(data, 'reason')
    });
    refresh(data);
    return {ok: true, data: {id: shift.id}};
  } catch (error) {
    return failure(error);
  }
}
