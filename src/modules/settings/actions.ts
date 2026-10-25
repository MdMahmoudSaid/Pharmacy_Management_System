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
      defaultLocale: String(data.get('defaultLocale')) === 'fr' ? 'fr' : 'ar',
      profile: {
        address: String(data.get('address') ?? ''),
        email: String(data.get('email') ?? ''),
        taxId: String(data.get('taxId') ?? ''),
        registration: String(data.get('registration') ?? ''),
        phones: [0, 1, 2].map((i) => ({code: String(data.get(`phoneCode${i}`) ?? '222'), number: String(data.get(`phone${i}`) ?? '')}))
      }
    });
    revalidatePath(`/${locale}/settings`);
    revalidatePath(`/${locale}/reports`, 'layout');
    return {ok: true, data: {ok: true}};
  } catch (error) {
    if (error instanceof AppError) return {ok: false, code: error.code};
    if (error instanceof ZodError) return {ok: false, code: 'VALIDATION_ERROR'};
    return {ok: false, code: 'INTERNAL_ERROR'};
  }
}
