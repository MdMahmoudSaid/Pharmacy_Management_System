'use server';

import {eq} from 'drizzle-orm';
import {cookies, headers} from 'next/headers';
import {redirect} from 'next/navigation';

import {db} from '@/db/client';
import {users} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {authenticate} from './service';
import {
  requireSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  setSessionCookie
} from './session';

type Locale = 'ar' | 'fr';
export type LoginActionState = {
  error?: 'AUTHENTICATION_FAILED' | 'RATE_LIMITED';
};

const localeFrom = (value: FormDataEntryValue | null): Locale =>
  value === 'fr' ? 'fr' : 'ar';

export async function loginAction(
  _previous: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const locale = localeFrom(formData.get('locale'));
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get('x-forwarded-for') ??
    requestHeaders.get('x-real-ip') ??
    'local';

  try {
    const session = await authenticate(
      String(formData.get('phone') ?? ''),
      String(formData.get('pin') ?? ''),
      origin
    );
    await db
      .update(users)
      .set({preferredLocale: locale, updatedAt: new Date()})
      .where(eq(users.id, session.user.id));
    await setSessionCookie(session.token, session.expiresAt);
  } catch (error) {
    if (error instanceof AppError && error.code === 'RATE_LIMITED') {
      return {error: 'RATE_LIMITED'};
    }
    return {error: 'AUTHENTICATION_FAILED'};
  }

  redirect(`/${locale}/dashboard`);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get('locale'));
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) await revokeSession(token);
  store.delete(SESSION_COOKIE_NAME);
  redirect(`/${locale}/login`);
}

export async function changeLocaleAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData.get('locale'));
  const actor = await requireSession();
  await db
    .update(users)
    .set({preferredLocale: locale, updatedAt: new Date()})
    .where(eq(users.id, actor.id));
  redirect(`/${locale}/dashboard`);
}
