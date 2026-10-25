import {Banknote, ChevronLeft, ChevronRight, Clock3, Landmark, Pill, Receipt, Scale, Truck} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';
import type {ReactNode} from 'react';

import {DASHBOARD_PRESETS, type DashboardPeriod} from '../period';
import type {getDashboardSummary} from '../queries';

type DashboardData = Awaited<ReturnType<typeof getDashboardSummary>>;
type FinanceSummary = {cash: string; netProfit: string; capital: string; inventoryValue: string};

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const countFormat = new Intl.NumberFormat('en-US');
const money = (value: string) => `${amountFormat.format(Number(value))} MRU`;

export async function DashboardView({data, finance, period, locale, children}: {data: DashboardData; finance?: FinanceSummary; period: DashboardPeriod; locale: 'ar' | 'fr'; children?: ReactNode}) {
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
    {key: 'openShifts', icon: Clock3, value: String(data.openShifts.length), caption: t('shiftsCaption')}
  ];

  const {catalog} = data;
  const medicinesHref = `/${locale}/medicines`;
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const renderCard = ({key, icon: Icon, value, unit, caption, negative}: (typeof cards)[number]) => (
    <article key={key}>
      <header><span>{t(key)}</span><Icon size={20} aria-hidden="true" /></header>
      <strong dir="ltr" className={negative ? 'is-negative' : undefined}>{value}{unit ? <small> {unit}</small> : null}</strong>
      <small>{caption}</small>
    </article>
  );

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
        {cards.slice(0, 3).map(renderCard)}
        {catalog ? (
          <article className="metric-catalog">
            <header>
              <Link href={medicinesHref} className="metric-link">{t('medicines')}<Chevron size={14} aria-hidden="true" /></Link>
              <Pill size={20} aria-hidden="true" />
            </header>
            <strong dir="ltr">{countFormat.format(catalog.total)}</strong>
            {catalog.out || catalog.low ? (
              <span className="metric-alerts">
                {catalog.out ? <Link href={`${medicinesHref}?filter=out`} className="metric-alert is-out">{t('medicinesOut', {count: catalog.out})}</Link> : null}
                {catalog.low ? <Link href={`${medicinesHref}?filter=low`} className="metric-alert is-low">{t('medicinesLow', {count: catalog.low})}</Link> : null}
              </span>
            ) : <small>{catalog.total ? t('medicinesAllGood') : t('medicinesCaption')}</small>}
          </article>
        ) : null}
        {cards.slice(3).map(renderCard)}
      </section>

      {finance ? <section className="dashboard-finance">
        <header><div><span className="section-icon"><Landmark size={20} /></span><div><h2>{t('financialOverview')}</h2><p>{t('financialOverviewHint')}</p></div></div><Link href={`/${locale}/accounts`}>{t('viewAccounts')}<Chevron size={15} /></Link></header>
        <div className="dashboard-finance-cards">
          <article><span>{t('availableCash')}</span><strong dir="ltr">{money(finance.cash)}</strong><small>{t('currentBalance')}</small></article>
          <article className="is-profit"><span>{t('periodNetProfit')}</span><strong dir="ltr">{money(finance.netProfit)}</strong><small>{periodCaption}</small></article>
          <article><span>{t('capital')}</span><strong dir="ltr">{money(finance.capital)}</strong><small>{t('currentBalance')}</small></article>
          <article><span>{t('inventoryValue')}</span><strong dir="ltr">{money(finance.inventoryValue)}</strong><small>{t('atCost')}</small></article>
        </div>
      </section> : null}

      {data.suppliers ? <section className="dashboard-suppliers">
        <header><div><span className="section-icon"><Truck size={20} /></span><div><h2>{t('supplierOverview')}</h2><p>{t('supplierOverviewHint')}</p></div></div><Link href={`/${locale}/suppliers`}>{t('viewSuppliers')}<Chevron size={15} /></Link></header>
        <div className="supplier-dashboard-cards"><article><span>{t('supplierDebt')}</span><strong dir="ltr">{money(data.suppliers.debt)}</strong><small>{t('supplierDebtCount', {count: data.suppliers.debtCount})}</small></article><article><span>{t('supplierAdvances')}</span><strong dir="ltr">{money(data.suppliers.advances)}</strong><small>{t('activeSuppliers', {count: data.suppliers.activeCount})}</small></article>{data.suppliers.largestDebts[0] ? <article className="supplier-focus"><span>{t('largestSupplierDebt')}</span><Link href={`/${locale}/suppliers/${data.suppliers.largestDebts[0].id}`}><strong>{data.suppliers.largestDebts[0].name}</strong><b dir="ltr">{money(data.suppliers.largestDebts[0].balance)}</b></Link></article> : <article className="supplier-focus is-clear"><span>{t('largestSupplierDebt')}</span><strong>{t('suppliersSettled')}</strong><small>{t('suppliersSettledHint')}</small></article>}</div>
      </section> : null}

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
