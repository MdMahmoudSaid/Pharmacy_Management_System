import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {changeLocaleAction, logoutAction} from '@/modules/auth/actions';
import {requireSession} from '@/modules/auth/session';
import {DashboardView} from '@/modules/dashboard/components/dashboard-view';
import {getDashboardSummary} from '@/modules/dashboard/queries';
import {can} from '@/modules/permissions/service';

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
  const dashboard = can(actor, 'reports.view.own', actor.id)
    ? await getDashboardSummary(actor)
    : null;

  return (
    <main className="page-content dashboard-page">
      <header className="page-heading">
        <p>{t('kicker')}</p>
        <h1>{t('welcome')}</h1>
        <span>{t('signedIn', {id: actor.id})}</span>
      </header>
      {dashboard ? <DashboardView data={dashboard} /> : null}
      <section className="dashboard-session-actions">
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
