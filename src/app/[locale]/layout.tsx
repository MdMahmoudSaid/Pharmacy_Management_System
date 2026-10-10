import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/600.css';
import '@fontsource/noto-sans-arabic/400.css';
import '@fontsource/noto-sans-arabic/600.css';
import '../globals.css';

import type {Metadata} from 'next';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import type {ReactNode} from 'react';

import {directionFor, routing} from '@/i18n/routing';
import {ServiceWorkerRegistration} from '@/components/service-worker-registration';

export const metadata: Metadata = {
  title: 'Pharmacy Management System',
  description: 'Gestion interne de la pharmacie'
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={directionFor(locale)}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ServiceWorkerRegistration />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
