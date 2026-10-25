'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';
import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {adjustStock, correctStockReceipt, receiveStock, receiveStockBatch} from './service';

export type StockActionState = ActionResult<{id: number}> | undefined;
const text = (data: FormData, key: string) => String(data.get(key) ?? '');
const refresh = (data: FormData) =>
  revalidatePath(`/${text(data, 'locale') === 'fr' ? 'fr' : 'ar'}/stock`);
const failure = (error: unknown): Exclude<StockActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
  return {ok: false, code: 'INTERNAL_ERROR'};
};

export async function receiveStockAction(
  _state: StockActionState,
  data: FormData
): Promise<StockActionState> {
  try {
    const receipt = await receiveStock(await requireSession(), {
      medicineId: Number(text(data, 'medicineId')),
      supplierId: Number(text(data, 'supplierId')),
      quantity: Number(text(data, 'quantity')),
      unitCost: text(data, 'unitCost'),
      sellingPrice: text(data, 'sellingPrice'),
      note: text(data, 'note')
    });
    refresh(data);
    return {ok: true, data: {id: receipt.id}};
  } catch (error) {
    return failure(error);
  }
}

// The receive form sends every line as one JSON field, so a variable number of rows stays one submission.
export async function receiveStockBatchAction(
  _state: StockActionState,
  data: FormData
): Promise<StockActionState> {
  try {
    let payload: {supplierId?: unknown; note?: unknown; lines?: unknown};
    try {
      payload = JSON.parse(text(data, 'payload'));
    } catch {
      return {ok: false, code: 'VALIDATION_ERROR'};
    }
    const receipts = await receiveStockBatch(await requireSession(), {
      supplierId: Number(payload.supplierId),
      note: typeof payload.note === 'string' && payload.note ? payload.note : undefined,
      lines: Array.isArray(payload.lines) ? payload.lines : []
    });
    refresh(data);
    return {ok: true, data: {id: receipts[0].id}};
  } catch (error) {
    return failure(error);
  }
}

export async function adjustStockAction(
  _state: StockActionState,
  data: FormData
): Promise<StockActionState> {
  try {
    const medicineId = Number(text(data, 'medicineId'));
    const medicine = await adjustStock(await requireSession(), {
      medicineId,
      quantityChange: Number(text(data, 'quantityChange')),
      reason: text(data, 'reason')
    });
    refresh(data);
    revalidatePath(`/${text(data, 'locale') === 'fr' ? 'fr' : 'ar'}/medicines/${medicineId}`);
    return {ok: true, data: {id: medicine.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function correctStockReceiptAction(
  _state: StockActionState,
  data: FormData
): Promise<StockActionState> {
  try {
    const receipt = await correctStockReceipt(await requireSession(), {
      receiptId: Number(text(data, 'receiptId')),
      medicineId: Number(text(data, 'medicineId')),
      quantity: Number(text(data, 'quantity')),
      reason: text(data, 'reason')
    });
    refresh(data);
    return {ok: true, data: {id: receipt.id}};
  } catch (error) {
    return failure(error);
  }
}
