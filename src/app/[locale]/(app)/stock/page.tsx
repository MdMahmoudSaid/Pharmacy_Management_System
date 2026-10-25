import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {searchMedicines} from '@/modules/medicines/service';
import {authorize, can} from '@/modules/permissions/service';
import {MovementList} from '@/modules/stock/components/movement-list';
import {ReceiveStockForm} from '@/modules/stock/components/receive-stock-form';
import {movementQuery, parseMovementFilters} from '@/modules/stock/filters';
import {getMedicineMovements} from '@/modules/stock/service';
import {listActiveSuppliers} from '@/modules/suppliers/queries';
import {summarizeStock} from '@/modules/stock/summary';

const text = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function StockPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const canReceive = can(actor, 'stock.receive.own', actor.id);
  const canViewAll = can(actor, 'stock.view.all');
  if (!canReceive && !canViewAll) authorize(actor, 'stock.view.all');
  const query = await searchParams;
  const filters = parseMovementFilters({type: text(query.type), period: text(query.period)});
  const [t, medicines, suppliers, movements] = await Promise.all([
    getTranslations('Stock'),
    canReceive || canViewAll ? searchMedicines() : [],
    canReceive ? listActiveSuppliers(actor) : [],
    canViewAll ? getMedicineMovements(movementQuery(filters)) : []
  ]);
  const summary = summarizeStock(medicines);
  const money = (value: string) => `${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(value))} MRU`;
  return (
    <main className="page-content catalog-page">
      <header className="page-heading">
        <p>{t('stockKicker')}</p>
        <h1>{t('stockTitle')}</h1>
        <span>{t('stockSubtitle')}</span>
      </header>
      <section className="stock-summary" aria-label={t('summary')}>
        <article><span>{t('activeMedicines')}</span><strong dir="ltr">{summary.medicineCount}</strong><small>{t('totalUnits', {count: summary.units})}</small></article>
        <article><span>{t('stockCostValue')}</span><strong dir="ltr">{money(summary.costValue)}</strong><small>{t('costValueHint')}</small></article>
        <article><span>{t('stockRetailValue')}</span><strong dir="ltr">{money(summary.retailValue)}</strong><small>{t('retailValueHint')}</small></article>
        <article className={summary.alertCount ? 'has-alert' : undefined}><span>{t('restockAlerts')}</span><strong dir="ltr">{summary.alertCount}</strong><small>{t('alertBreakdown', {low: summary.lowCount, out: summary.outCount})}</small></article>
      </section>
      {canReceive ? <ReceiveStockForm medicines={medicines} suppliers={suppliers} locale={locale} /> : null}
      {canViewAll ? <MovementList rows={movements} filters={filters} locale={locale} /> : null}
    </main>
  );
}
