import {Banknote, Clock3, PackagePlus, Receipt, Scale} from 'lucide-react';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {getShiftDetail} from '@/modules/shifts/queries';

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const money = (value: string) => `${amountFormat.format(Number(value))} MRU`;

export default async function ShiftDetailPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  let detail;
  try {
    detail = await getShiftDetail(actor, Number(id));
  } catch {
    notFound();
  }
  const t = await getTranslations('Shifts');
  const format = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  const timeFormat = new Intl.DateTimeFormat(locale, {timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  const separator = locale === 'ar' ? '، ' : ', ';
  const {shift, totals} = detail;
  const isOpen = shift.status === 'OPEN';
  const minutes = Math.max(0, Math.round(((shift.closedAt ?? new Date()).getTime() - shift.openedAt.getTime()) / 60_000));
  const duration = t('durationValue', {hours: Math.floor(minutes / 60), minutes: minutes % 60});
  const canOpenSales = can(actor, 'sales.view.own', shift.userId);

  const cards = [
    {key: 'salesTotal', icon: Banknote, value: totals.sales, caption: t('salesCount', {count: totals.salesCount})},
    {key: 'expensesTotal', icon: Receipt, value: totals.expenses, caption: t('expensesCount', {count: detail.expenses.filter(({status}) => status === 'ACTIVE').length})},
    {key: 'netTotal', icon: Scale, value: totals.net, caption: t('netCaption'), negative: Number(totals.net) < 0},
    {key: 'stockReceived', icon: PackagePlus, value: null, caption: t('receiptsCount', {count: detail.receipts.filter(({status}) => status === 'ACTIVE').length})}
  ];

  return (
    <main className="page-content shift-detail-page">
      <header className="page-heading">
        <p>{t('detailKicker')}</p>
        <h1>{detail.userName}</h1>
        <span className="shift-detail-period">
          <bdi>{format.format(shift.openedAt)}</bdi> — <bdi>{shift.closedAt ? format.format(shift.closedAt) : t('ongoing')}</bdi>
        </span>
        <span className="shift-detail-badges">
          <span className={isOpen ? 'status-active' : 'status-archived'}>{isOpen ? t('openStatus') : t('closedStatus')}</span>
          <span className="shift-duration"><Clock3 size={14} aria-hidden="true" />{duration}</span>
        </span>
        <Link href={`/${locale}/shifts`}>{t('backToShifts')}</Link>
      </header>

      <section className="dashboard-metrics shift-metrics">
        {cards.map(({key, icon: Icon, value, caption, negative}) => (
          <article key={key}>
            <header><span>{t(key)}</span><Icon size={20} aria-hidden="true" /></header>
            <strong dir={value === null ? undefined : 'ltr'} className={negative ? 'is-negative' : undefined}>
              {value === null ? t('units', {count: totals.unitsReceived}) : <>{amountFormat.format(Number(value))}<small> MRU</small></>}
            </strong>
            <small>{caption}</small>
          </article>
        ))}
      </section>

      <section className="recent-operations shift-section" data-testid="shift-sales">
        <header><h2>{t('salesSection')}</h2><span>{t('salesCount', {count: totals.salesCount})}</span></header>
        {detail.sales.length ? (
          <ul>
            {detail.sales.map((sale) => {
              const cancelled = sale.status === 'CANCELLED';
              const label = sale.items.map(({name, quantity}) => (quantity > 1 ? `${name} × ${quantity}` : name)).join(separator);
              return (
                <li key={sale.id} data-kind="sale" className={cancelled ? 'is-cancelled' : undefined}>
                  <strong>
                    {canOpenSales ? <Link href={`/${locale}/sales/${sale.id}`}>{label}</Link> : label}
                    {cancelled ? <em>{t('cancelled')}</em> : null}
                  </strong>
                  <time dateTime={sale.createdAt.toISOString()}>{timeFormat.format(sale.createdAt)}</time>
                  <b dir="ltr">+{money(sale.total)}</b>
                </li>
              );
            })}
          </ul>
        ) : <p className="recent-empty">{t('noSales')}</p>}
      </section>

      <section className="recent-operations shift-section" data-testid="shift-expenses">
        <header><h2>{t('expensesSection')}</h2><span dir="ltr">{money(totals.expenses)}</span></header>
        {detail.expenses.length ? (
          <ul>
            {detail.expenses.map((expense) => {
              const cancelled = expense.status === 'CANCELLED';
              const label = [expense.categoryName, expense.description].filter(Boolean).join(' · ');
              return (
                <li key={expense.id} className={cancelled ? 'is-cancelled' : undefined}>
                  <strong>{label}{cancelled ? <em>{t('cancelled')}</em> : null}</strong>
                  <time dateTime={expense.occurredAt.toISOString()}>{timeFormat.format(expense.occurredAt)}</time>
                  <b dir="ltr">-{money(expense.amount)}</b>
                </li>
              );
            })}
          </ul>
        ) : <p className="recent-empty">{t('noExpenses')}</p>}
      </section>

      <section className="recent-operations shift-section" data-testid="shift-receipts">
        <header><h2>{t('receiptsSection')}</h2><span>{t('units', {count: totals.unitsReceived})}</span></header>
        {detail.receipts.length ? (
          <ul>
            {detail.receipts.map((receipt) => {
              const cancelled = receipt.status === 'CANCELLED';
              return (
                <li key={receipt.id} data-kind="stock" className={cancelled ? 'is-cancelled' : undefined}>
                  <strong>{receipt.medicineName}{cancelled ? <em>{t('cancelled')}</em> : null}</strong>
                  <time dateTime={receipt.occurredAt.toISOString()}>{timeFormat.format(receipt.occurredAt)}</time>
                  <b>{t('units', {count: receipt.quantity})}</b>
                </li>
              );
            })}
          </ul>
        ) : <p className="recent-empty">{t('noReceipts')}</p>}
      </section>

      {detail.corrections.length ? (
        <section className="shift-section shift-corrections" data-testid="shift-corrections">
          <header><h2>{t('correctionsSection')}</h2></header>
          <ol className="audit-timeline">
            {detail.corrections.map((entry) => (
              <li key={entry.id}>
                <strong>{t(`correctionActions.${entry.action as 'CORRECT' | 'REOPEN'}`)}</strong>
                <span><bdi>{entry.actorName}</bdi> · <bdi>{format.format(entry.createdAt)}</bdi></span>
                {entry.reason ? <p>{entry.reason}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
