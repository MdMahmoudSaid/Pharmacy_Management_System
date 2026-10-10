'use server';

import {ZodError} from 'zod';
import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {createSale} from './service';

export type SaleActionState = ActionResult<{id: number; total: string}> | undefined;

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
