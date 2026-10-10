'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';
import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {archiveMedicine, createMedicine, restoreMedicine, updateMedicine} from './service';

export type MedicineActionState = ActionResult<{id: number}> | undefined;
const text = (data: FormData, key: string) => String(data.get(key) ?? '');
const refresh = (data: FormData) =>
  revalidatePath(`/${text(data, 'locale') === 'fr' ? 'fr' : 'ar'}/medicines`);
const failure = (error: unknown): Exclude<MedicineActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
  return {ok: false, code: 'INTERNAL_ERROR'};
};

export async function createMedicineAction(
  _state: MedicineActionState,
  data: FormData
): Promise<MedicineActionState> {
  try {
    const medicine = await createMedicine(await requireSession(), {
      name: text(data, 'name'),
      code: text(data, 'code') || null,
      sellingPrice: text(data, 'sellingPrice')
    });
    refresh(data);
    return {ok: true, data: {id: medicine.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function updateMedicineAction(
  _state: MedicineActionState,
  data: FormData
): Promise<MedicineActionState> {
  try {
    const medicine = await updateMedicine(await requireSession(), {
      id: Number(text(data, 'id')),
      name: text(data, 'name'),
      code: text(data, 'code') || null,
      sellingPrice: text(data, 'sellingPrice'),
      reason: text(data, 'reason')
    });
    refresh(data);
    return {ok: true, data: {id: medicine.id}};
  } catch (error) {
    return failure(error);
  }
}

async function activeAction(data: FormData, restore: boolean): Promise<MedicineActionState> {
  try {
    const actor = await requireSession();
    const id = Number(text(data, 'id'));
    await (restore ? restoreMedicine : archiveMedicine)(actor, id, text(data, 'reason'));
    refresh(data);
    return {ok: true, data: {id}};
  } catch (error) {
    return failure(error);
  }
}

export async function archiveMedicineAction(_state: MedicineActionState, data: FormData) {
  return activeAction(data, false);
}
export async function restoreMedicineAction(_state: MedicineActionState, data: FormData) {
  return activeAction(data, true);
}
