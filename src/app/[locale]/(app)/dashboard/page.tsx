import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {changeLocaleAction, logoutAction} from '@/modules/auth/actions';
import {requireSession} from '@/modules/auth/session';

export default async function DashboardPage({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [actor, t] = await Promise.all([
    requireSession(),
    getTranslations('Dashboard')
  ]);
  const otherLocale = locale === 'ar' ? 'fr' : 'ar';

  return (
    <main className="welcome-shell">
      <section className="welcome-card">
        <div className="brand-mark">+</div>
        <div>
          <h1>{t('welcome')}</h1>
          <p>{t('signedIn', {id: actor.id})}</p>
        </div>
        <div className="dashboard-actions">
          <form action={changeLocaleAction}>
            <input type="hidden" name="locale" value={otherLocale} />
            <button className="secondary-action">{t('switchLanguage')}</button>
          </form>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="primary-action">{t('logout')}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
