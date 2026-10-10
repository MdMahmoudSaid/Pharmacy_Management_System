'use server';

import {ZodError} from 'zod';
import {revalidatePath} from 'next/cache';
import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {cancelSale, correctSale, createSale} from './service';

export type SaleActionState = ActionResult<{id: number; total: string}> | undefined;
export type SaleChangeActionState = ActionResult<{id: number}> | undefined;

const value = (data: FormData, key: string) => String(data.get(key) ?? '');
const locale = (data: FormData) => (value(data, 'locale') === 'fr' ? 'fr' : 'ar');
const refresh = (data: FormData, id: number) => {
  revalidatePath(`/${locale(data)}/sales`);
  revalidatePath(`/${locale(data)}/sales/${id}`);
};

const failure = (error: unknown): Exclude<SaleChangeActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return {ok: false, code: 'VALIDATION_ERROR'};
  }
  return {ok: false, code: 'INTERNAL_ERROR'};
};

export async function createSaleAction(
  _state: SaleActionState,
  data: FormData
): Promise<SaleActionState> {
  try {
    const parsed = JSON.parse(String(data.get('items') ?? '[]')) as Array<{
      medicineId: number;
      quantity: number;
      unitPrice?: string;
      overrideReason?: string;
    }>;
    const sale = await createSale(await requireSession(), {
      shiftId: Number(data.get('shiftId')),
      idempotencyKey: String(data.get('idempotencyKey') ?? ''),
      items: parsed
    });
    return {ok: true, data: {id: sale.id, total: sale.total}};
  } catch (error) {
    if (error instanceof AppError) return {ok: false, code: error.code};
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return {ok: false, code: 'VALIDATION_ERROR'};
    }
    return {ok: false, code: 'INTERNAL_ERROR'};
  }
}

export async function correctSaleAction(
  _state: SaleChangeActionState,
  data: FormData
): Promise<SaleChangeActionState> {
  try {
    const id = Number(value(data, 'id'));
    const items = JSON.parse(value(data, 'items')) as Array<{
      medicineId: number;
      quantity: number;
      unitPrice?: string;
    }>;
    const sale = await correctSale(
      await requireSession(),
      id,
      items,
      value(data, 'reason')
    );
    refresh(data, id);
    return {ok: true, data: {id: sale.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function cancelSaleAction(
  _state: SaleChangeActionState,
  data: FormData
): Promise<SaleChangeActionState> {
  try {
    const id = Number(value(data, 'id'));
    const sale = await cancelSale(
      await requireSession(),
      id,
      value(data, 'reason')
    );
    refresh(data, id);
    return {ok: true, data: {id: sale.id}};
  } catch (error) {
    return failure(error);
  }
}
