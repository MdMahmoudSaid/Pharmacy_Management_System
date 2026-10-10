import Decimal from 'decimal.js';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {SALE_PERIODS, type SalePeriod} from '../period';

type SaleRow = {
  sale: {
    id: number;
    total: string;
    status: 'COMPLETED' | 'CANCELLED';
    createdAt: Date;
  };
  operatorName: string;
  items: Array<{name: string; quantity: number}>;
};

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

export async function SaleHistory({rows, locale, period}: {
  rows: SaleRow[];
  locale: 'ar' | 'fr';
  period: SalePeriod;
}) {
  const t = await getTranslations('Sales');
  const format = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  const separator = locale === 'ar' ? '، ' : ', ';
  const completed = rows.filter(({sale}) => sale.status === 'COMPLETED');
  const total = completed.reduce((sum, {sale}) => sum.plus(sale.total), new Decimal(0));
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  return (
    <section className="sale-history" aria-labelledby="sale-history-title">
      <header className="sale-history-header">
        <h2 id="sale-history-title">{t('history')}</h2>
        <span>{t('historySummary', {count: completed.length, total: amountFormat.format(total.toNumber())})}</span>
      </header>
      <nav className="filter-pills" aria-label={t('history')}>
        {SALE_PERIODS.map((value) => (
          <Link
            key={value}
            href={value === 'today' ? `/${locale}/sales` : `/${locale}/sales?period=${value}`}
            scroll={false}
            aria-current={period === value ? 'page' : undefined}
          >
            {t(value)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? <p className="catalog-empty">{t('historyEmpty')}</p> : (
        <div className="sale-history-rows">
          {rows.map(({sale, operatorName, items}) => {
            const cancelled = sale.status === 'CANCELLED';
            return (
              <Link href={`/${locale}/sales/${sale.id}`} key={sale.id} className={cancelled ? 'is-cancelled' : undefined}>
                <span className="sale-history-main">
                  <strong>
                    {items.map(({name, quantity}) => (quantity > 1 ? `${name} × ${quantity}` : name)).join(separator)}
                    {cancelled ? <em>{t('cancelled')}</em> : null}
                  </strong>
                  <small><bdi>{operatorName}</bdi> · <bdi>{format.format(sale.createdAt)}</bdi></small>
                </span>
                <b dir="ltr">{amountFormat.format(Number(sale.total))} <small>MRU</small></b>
                <Chevron size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
