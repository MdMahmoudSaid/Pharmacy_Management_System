'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';

import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {isPermissionKey, type PermissionKey} from '@/modules/permissions/catalog';
import {
  archiveEmployee,
  createEmployee,
  replaceEmployeePin,
  restoreEmployee,
  setEmployeePermissions,
  updateEmployee
} from './service';

export type EmployeeActionState = ActionResult<{id?: number}> | undefined;

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? '');
const idFrom = (formData: FormData) => Number(text(formData, 'id'));
const localeFrom = (formData: FormData) =>
  text(formData, 'locale') === 'fr' ? 'fr' : 'ar';

function failure(error: unknown): Exclude<EmployeeActionState, undefined> {
  if (error instanceof AppError) return {ok: false, code: error.code};
  if (error instanceof ZodError) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      fieldErrors: error.flatten().fieldErrors
    };
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'cause' in error &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'code' in error.cause &&
    error.cause.code === '23505'
  ) {
    return {ok: false, code: 'CONFLICT'};
  }
  return {ok: false, code: 'INTERNAL_ERROR'};
}

const refresh = (formData: FormData) =>
  revalidatePath(`/${localeFrom(formData)}/employees`);

export async function createEmployeeAction(
  _previous: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  try {
    const actor = await requireSession();
    const employee = await createEmployee(actor, {
      name: text(formData, 'name'),
      phone: text(formData, 'phone'),
      pin: text(formData, 'pin')
    });
    refresh(formData);
    return {ok: true, data: {id: employee.id}};
  } catch (error) {
    return failure(error);
  }
}

export async function updateEmployeeAction(
  _previous: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  try {
    const actor = await requireSession();
    const employee = await updateEmployee(actor, {
      id: idFrom(formData),
      name: text(formData, 'name'),
      phone: text(formData, 'phone')
    });
    refresh(formData);
    return {ok: true, data: {id: employee.id}};
  } catch (error) {
    return failure(error);
  }
}

async function activeStateAction(
  formData: FormData,
  restore: boolean
): Promise<EmployeeActionState> {
  try {
    const actor = await requireSession();
    const operation = restore ? restoreEmployee : archiveEmployee;
    await operation(actor, idFrom(formData), text(formData, 'reason'));
    refresh(formData);
    return {ok: true, data: {id: idFrom(formData)}};
  } catch (error) {
    return failure(error);
  }
}

export async function archiveEmployeeAction(
  _previous: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  return activeStateAction(formData, false);
}

export async function restoreEmployeeAction(
  _previous: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  return activeStateAction(formData, true);
}

export async function resetEmployeePinAction(
  _previous: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  try {
    const actor = await requireSession();
    await replaceEmployeePin(
      actor,
      idFrom(formData),
      text(formData, 'pin'),
      text(formData, 'reason')
    );
    refresh(formData);
    return {ok: true, data: {id: idFrom(formData)}};
  } catch (error) {
    return failure(error);
  }
}

export async function setEmployeePermissionsAction(
  _previous: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  try {
    const actor = await requireSession();
    const permissions = formData
      .getAll('permissions')
      .map(String)
      .filter(isPermissionKey) as PermissionKey[];
    await setEmployeePermissions(
      actor,
      idFrom(formData),
      permissions,
      text(formData, 'reason')
    );
    refresh(formData);
    return {ok: true, data: {id: idFrom(formData)}};
  } catch (error) {
    return failure(error);
  }
}
