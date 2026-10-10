'use server';

import {revalidatePath} from 'next/cache';
import {ZodError} from 'zod';
import type {ActionResult} from '@/lib/action-result';
import {AppError} from '@/lib/errors';
import {requireSession} from '@/modules/auth/session';
import {updateSettings} from './service';

export type SettingsActionState = ActionResult<{ok: true}> | undefined;
export async function updateSettingsAction(_state: SettingsActionState, data: FormData): Promise<SettingsActionState> {
  try {
    const locale = String(data.get('locale')) === 'fr' ? 'fr' : 'ar';
    await updateSettings(await requireSession(), {
      pharmacyName: String(data.get('pharmacyName') ?? ''),
      defaultLocale: String(data.get('defaultLocale')) === 'fr' ? 'fr' : 'ar'
    });
    revalidatePath(`/${locale}/settings`);
    return {ok: true, data: {ok: true}};
  } catch (error) {
    if (error instanceof AppError) return {ok: false, code: error.code};
    if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
    return {ok: false, code: 'INTERNAL_ERROR'};
  }
}
