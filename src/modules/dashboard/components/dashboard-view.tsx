import {Banknote, Boxes, Clock3, Receipt, Scale} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import type {ReactNode} from 'react';

import {DASHBOARD_PRESETS, type DashboardPeriod} from '../period';
import type {getDashboardSummary} from '../queries';

type DashboardData = Awaited<ReturnType<typeof getDashboardSummary>>;

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const countFormat = new Intl.NumberFormat('en-US');
const money = (value: string) => `${amountFormat.format(Number(value))} MRU`;

export async function DashboardView({data, period, locale, children}: {data: DashboardData; period: DashboardPeriod; locale: 'ar' | 'fr'; children?: ReactNode}) {
  const t = await getTranslations('Dashboard');
  const dayFormat = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Africa/Nouakchott'});
  const timeFormat = new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  const lastDay = new Date(period.range.to.getTime() - 1);
  const periodCaption = period.preset === 'custom'
    ? `${dayFormat.format(period.range.from)} – ${dayFormat.format(lastDay)}`
    : t(period.preset);

  const cards = [
    {key: 'sales', icon: Banknote, value: amountFormat.format(Number(data.summary.salesTotal)), unit: 'MRU', caption: periodCaption},
    {key: 'expenses', icon: Receipt, value: amountFormat.format(Number(data.summary.expensesTotal)), unit: 'MRU', caption: periodCaption},
    {key: 'net', icon: Scale, value: amountFormat.format(Number(data.summary.netTotal)), unit: 'MRU', caption: periodCaption, negative: Number(data.summary.netTotal) < 0},
    {key: 'stockUnits', icon: Boxes, value: countFormat.format(data.stockUnits), caption: t('stockCaption')},
    {key: 'openShifts', icon: Clock3, value: String(data.openShifts.length), caption: t('shiftsCaption')}
  ];

  return (
    <>
      <section className="dashboard-period no-print" aria-label={t('periodFilter')}>
        <nav className="period-tabs">
          {DASHBOARD_PRESETS.map((preset) => (
            <Link key={preset} href={`/${locale}/dashboard?period=${preset}`} aria-current={period.preset === preset ? 'page' : undefined}>
              {t(preset)}
            </Link>
          ))}
        </nav>
        <form className="period-custom">
          <label><span>{t('from')}</span><input type="date" name="from" defaultValue={period.preset === 'custom' ? period.from : ''} required /></label>
          <label><span>{t('to')}</span><input type="date" name="to" defaultValue={period.preset === 'custom' ? period.to : ''} required /></label>
          <button className="primary-action">{t('apply')}</button>
        </form>
      </section>

      <section className="dashboard-metrics">
        {cards.map(({key, icon: Icon, value, unit, caption, negative}) => (
          <article key={key}>
            <header><span>{t(key)}</span><Icon size={20} aria-hidden="true" /></header>
            <strong dir="ltr" className={negative ? 'is-negative' : undefined}>{value}{unit ? <small> {unit}</small> : null}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </section>

      {children}

      <section className="recent-operations">
        <header><h2>{t('recentOperations')}</h2><span>{periodCaption}</span></header>
        {data.recentOperations.length ? (
          <ul>
            {data.recentOperations.map((operation) => {
              const label = operation.kind === 'sale'
                ? operation.medicines.length
                  ? t('saleLabel', {items: operation.medicines.join(locale === 'ar' ? '، ' : ', ')})
                  : t('saleFallback')
                : operation.kind === 'expense'
                  ? t('expenseLabel', {description: operation.description})
                  : t('stockLabel', {medicine: operation.medicineName});
              const cancelled = operation.kind !== 'stock' && operation.cancelled;
              const amount = operation.kind === 'sale'
                ? `+${money(operation.amount)}`
                : operation.kind === 'expense'
                  ? `-${money(operation.amount)}`
                  : `+${t('units', {count: operation.quantity})}`;
              return (
                <li key={`${operation.kind}-${operation.id}`} className={cancelled ? 'is-cancelled' : undefined} data-kind={operation.kind}>
                  <strong>{label}{cancelled ? <em>{t('cancelled')}</em> : null}</strong>
                  <time dateTime={operation.at.toISOString()}>{timeFormat.format(operation.at)}</time>
                  <b dir="ltr">{amount}</b>
                </li>
              );
            })}
          </ul>
        ) : <p className="recent-empty">{t('noOperations')}</p>}
      </section>
    </>
  );
}
