'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';

import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {
  createSupplier,
  recordSupplierDebt,
  recordSupplierPayment,
  setSupplierActive,
  updateSupplier
} from './service';

export type SupplierActionState = ActionResult<{id: number}> | undefined;
const text = (data: FormData, key: string) => String(data.get(key) ?? '');
const optional = (data: FormData, key: string) => text(data, key) || undefined;
const refresh = (data: FormData, id?: number) => {
  const locale = text(data, 'locale') === 'fr' ? 'fr' : 'ar';
  revalidatePath(`/${locale}/suppliers`);
  if (id) revalidatePath(`/${locale}/suppliers/${id}`);
};
const failure = (error: unknown): Exclude<SupplierActionState, undefined> => {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
  return {ok: false, code: 'INTERNAL_ERROR'};
};
const fields = (data: FormData) => ({
  name: text(data, 'name'),
  phone: optional(data, 'phone'),
  contactPerson: optional(data, 'contactPerson'),
  address: optional(data, 'address'),
  note: optional(data, 'note')
});

export async function createSupplierAction(_state: SupplierActionState, data: FormData) {
  try {
    const supplier = await createSupplier(await requireSession(), fields(data));
    refresh(data, supplier.id);
    return {ok: true as const, data: {id: supplier.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function updateSupplierAction(_state: SupplierActionState, data: FormData) {
  try {
    const id = Number(text(data, 'id'));
    const supplier = await updateSupplier(await requireSession(), {id, ...fields(data)});
    refresh(data, id);
    return {ok: true as const, data: {id: supplier.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function setSupplierActiveAction(_state: SupplierActionState, data: FormData) {
  try {
    const id = Number(text(data, 'id'));
    await setSupplierActive(await requireSession(), id, text(data, 'active') === 'true');
    refresh(data, id);
    return {ok: true as const, data: {id}};
  } catch (error) {
    return failure(error);
  }
}

export async function recordSupplierPaymentAction(_state: SupplierActionState, data: FormData) {
  try {
    const supplierId = Number(text(data, 'supplierId'));
    const payment = await recordSupplierPayment(await requireSession(), {
      supplierId,
      amount: text(data, 'amount'),
      occurredAt: optional(data, 'occurredAt') ? new Date(`${text(data, 'occurredAt')}T12:00:00Z`) : undefined,
      reference: optional(data, 'reference'),
      note: optional(data, 'note')
    });
    refresh(data, supplierId);
    return {ok: true as const, data: {id: payment.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function recordSupplierDebtAction(_state: SupplierActionState, data: FormData) {
  try {
    const supplierId = Number(text(data, 'supplierId'));
    const debt = await recordSupplierDebt(await requireSession(), {
      supplierId,
      amount: text(data, 'amount'),
      occurredAt: optional(data, 'occurredAt') ? new Date(`${text(data, 'occurredAt')}T12:00:00Z`) : undefined,
      note: optional(data, 'note')
    });
    refresh(data, supplierId);
    return {ok: true as const, data: {id: debt.id}};
  } catch (error) {
    return failure(error);
  }
}
