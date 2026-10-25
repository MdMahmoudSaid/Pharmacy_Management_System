import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import Link from 'next/link';

import {routing} from '@/i18n/routing';
import {AccountsWorkspace} from '@/modules/accounts/components/accounts-workspace';
import {getAccountsOverview} from '@/modules/accounts/queries';
import {parseAccountsPeriod} from '@/modules/accounts/period';
import {DASHBOARD_PRESETS} from '@/modules/dashboard/period';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';

const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;

export default async function AccountsPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [actor, query] = await Promise.all([requireSession(), searchParams]);
  const period = parseAccountsPeriod({period: text(query.period), from: text(query.from), to: text(query.to)});
  const [t, overview] = await Promise.all([
    getTranslations('Accounts'),
    getAccountsOverview(actor, period.range)
  ]);
  const dayFormat = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Africa/Nouakchott'});
  const periodCaption = period.preset === 'custom'
    ? `${dayFormat.format(period.range.from)} – ${dayFormat.format(new Date(period.range.to.getTime() - 1))}`
    : t(period.preset);
  return <main className="page-content accounts-page">
    <header className="page-heading"><p>{t('kicker')}</p><h1>{t('title')}</h1><span>{t('subtitle')}</span></header>
    <section className="dashboard-period no-print" aria-label={t('periodFilter')}>
      <nav className="period-tabs">
        {DASHBOARD_PRESETS.map((preset) => <Link key={preset} href={`/${locale}/accounts?period=${preset}`} aria-current={period.preset === preset ? 'page' : undefined}>{t(preset)}</Link>)}
        <span className={period.preset === 'custom' ? 'is-current' : undefined}>{t('custom')}</span>
      </nav>
      <form className="period-custom">
        <label><span>{t('from')}</span><input type="date" name="from" defaultValue={period.preset === 'custom' ? period.from : ''} required /></label>
        <label><span>{t('to')}</span><input type="date" name="to" defaultValue={period.preset === 'custom' ? period.to : ''} required /></label>
        <button className="primary-action">{t('apply')}</button>
      </form>
    </section>
    <AccountsWorkspace {...overview} periodCaption={periodCaption} locale={locale} canManage={can(actor, 'accounts.manage.all')} />
  </main>;
}
