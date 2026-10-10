import {hasLocale} from 'next-intl';
import {notFound, redirect} from 'next/navigation';
import type {ReactNode} from 'react';

import {AppShell} from '@/components/app-shell';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';

export default async function AuthenticatedLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  let actor;
  try {
    actor = await requireSession();
  } catch {
    redirect(`/${locale}/login`);
  }
  return (
    <AppShell actor={actor} locale={locale}>
      {children}
    </AppShell>
  );
}
