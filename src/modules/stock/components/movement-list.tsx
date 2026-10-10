'use client';

import {ArrowDownLeft, ArrowUpRight, Search} from 'lucide-react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useDeferredValue, useState} from 'react';

import {MOVEMENT_PERIODS, MOVEMENT_TYPE_FILTERS, type MovementFilters} from '../filters';

type MovementRow = {
  movement: {
    id: number;
    type: 'STOCK_RECEIVED' | 'SALE' | 'SALE_CANCELLATION' | 'SALE_CORRECTION' | 'STOCK_RECEIPT_CORRECTION' | 'MANUAL_CORRECTION' | 'OTHER_ADJUSTMENT';
    quantityBefore: number;
    quantityChange: number;
    quantityAfter: number;
    note: string | null;
    reason: string | null;
    createdAt: Date;
  };
  medicineName: string;
  actorName: string;
};

const typeLabel = {all: 'typeAll', received: 'typeReceived', sales: 'typeSales', corrections: 'typeCorrections'} as const;
const periodLabel = {all: 'periodAll', today: 'today', this_week: 'this_week', this_month: 'this_month'} as const;

export function MovementList({rows, filters, locale}: {rows: MovementRow[]; filters: MovementFilters; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Stock');
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim().toLocaleLowerCase());
  const format = new Intl.DateTimeFormat(locale, {dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  const href = (next: Partial<MovementFilters>) => {
    const params = new URLSearchParams();
    const merged = {...filters, ...next};
    if (merged.type !== 'all') params.set('type', merged.type);
    if (merged.period !== 'all') params.set('period', merged.period);
    const text = params.toString();
    return `/${locale}/stock${text ? `?${text}` : ''}`;
  };
  const visible = rows.filter(({medicineName}) => medicineName.toLocaleLowerCase().includes(search));

  return (
    <section className="movement-history" aria-labelledby="movement-history-title">
      <h2 id="movement-history-title">{t('movements')}</h2>
      <div className="catalog-toolbar">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchMovements')} aria-label={t('searchMovements')} />
        </label>
        <nav className="filter-pills" aria-label={t('typeAll')}>
          {MOVEMENT_TYPE_FILTERS.map((type) => (
            <Link key={type} href={href({type})} scroll={false} aria-current={filters.type === type ? 'page' : undefined}>{t(typeLabel[type])}</Link>
          ))}
        </nav>
        <nav className="filter-pills" aria-label={t('periodAll')}>
          {MOVEMENT_PERIODS.map((period) => (
            <Link key={period} href={href({period})} scroll={false} aria-current={filters.period === period ? 'page' : undefined}>{t(periodLabel[period])}</Link>
          ))}
        </nav>
      </div>
      {visible.length ? (
        <ul className="movement-rows">
          {visible.map(({movement, medicineName, actorName}) => {
            const incoming = movement.quantityChange >= 0;
            return (
              <li key={movement.id} data-type={movement.type}>
                <span className={incoming ? 'movement-icon is-in' : 'movement-icon is-out'} aria-hidden="true">
                  {incoming ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </span>
                <div className="movement-main">
                  <strong>{medicineName}</strong>
                  <small>
                    {t(`types.${movement.type}`)} · <bdi>{actorName}</bdi> · <bdi>{format.format(movement.createdAt)}</bdi>
                  </small>
                  {movement.reason || movement.note ? <p>{movement.reason ?? movement.note}</p> : null}
                </div>
                <div className="movement-quantity">
                  <b dir="ltr" className={incoming ? 'is-in' : 'is-out'}>{incoming ? '+' : ''}{movement.quantityChange}</b>
                  <small>{t('balance', {before: movement.quantityBefore, after: movement.quantityAfter})}</small>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="catalog-empty">{t('noMovements')}</p>
      )}
    </section>
  );
}
