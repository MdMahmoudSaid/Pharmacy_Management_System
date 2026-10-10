import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ar', 'fr'],
  defaultLocale: 'ar'
});

export type AppLocale = (typeof routing.locales)[number];

export function directionFor(locale: AppLocale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
