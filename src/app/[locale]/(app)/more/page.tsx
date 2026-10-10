import {ChevronLeft, ChevronRight, LogOut} from 'lucide-react';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {MOBILE_BAR_KEYS, navItems} from '@/components/app-shell';
import {routing} from '@/i18n/routing';
import {logoutAction} from '@/modules/auth/actions';
import {requireSession} from '@/modules/auth/session';

export default async function MorePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const t = await getTranslations('Navigation');
  const links = navItems(actor, locale).filter(({key}) => !MOBILE_BAR_KEYS.includes(key));
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <main className="page-content">
      <header className="page-heading">
        <h1>{t('more')}</h1>
        <span>{t('moreSubtitle')}</span>
      </header>
      <nav className="more-links" aria-label={t('more')}>
        {links.map(({key, href, icon: Icon}) => (
          <Link href={href} key={key}>
            <span className="more-link-icon"><Icon size={20} aria-hidden="true" /></span>
            <strong>{t(key)}</strong>
            <Chevron size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <form action={logoutAction} className="more-logout">
        <input type="hidden" name="locale" value={locale} />
        <button className="secondary-action"><LogOut size={18} aria-hidden="true" />{t('logout')}</button>
      </form>
    </main>
  );
}
