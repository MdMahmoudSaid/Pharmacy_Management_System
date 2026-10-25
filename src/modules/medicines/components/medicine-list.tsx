'use client';

import Decimal from 'decimal.js';
import {Archive, Search} from 'lucide-react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useDeferredValue, useState} from 'react';
import {MEDICINE_FILTERS as FILTERS, type MedicineFilter as Filter} from '../filters';

type Medicine = {
  id: number;
  name: string;
  code: string | null;
  sellingPrice: string;
  currentStock: number;
  minStock: number;
  isActive: boolean;
};

type Status = 'available' | 'low' | 'out' | 'archived';
// The four stat cards double as the list filters; archived medicines sit behind a separate toggle.
const STAT_CARDS = [
  {key: 'all', label: 'statTotal'},
  {key: 'available', label: 'statAvailable'},
  {key: 'low', label: 'statLow'},
  {key: 'out', label: 'statOut'}
] as const;

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

export function stockStatus(medicine: Pick<Medicine, 'isActive' | 'currentStock' | 'minStock'>): Status {
  if (!medicine.isActive) return 'archived';
  if (medicine.currentStock === 0) return 'out';
  if (medicine.currentStock <= medicine.minStock) return 'low';
  return 'available';
}

function MedicineRow({medicine, locale}: {
  medicine: Medicine;
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Stock');
  const status = stockStatus(medicine);
  return (
    <article className={`medicine-row is-${status}`}>
      <Link className="medicine-detail-link" href={`/${locale}/medicines/${medicine.id}`}>
        <div className="medicine-row-main">
          <strong>{medicine.name}</strong>
          {medicine.code ? <small><bdi>{medicine.code}</bdi></small> : null}
        </div>
        <span className={`stock-badge is-${status}`}>
          {status === 'archived' ? t('filterArchived') : t('stockCount', {count: medicine.currentStock})}
        </span>
        <b dir="ltr">{amountFormat.format(Number(medicine.sellingPrice))} <small>MRU</small></b>
      </Link>
    </article>
  );
}

export function MedicineList({medicines, locale, initialFilter = 'all'}: {
  medicines: Medicine[];
  locale: 'ar' | 'fr';
  canEdit: boolean;
  canArchive: boolean;
  initialFilter?: Filter;
}) {
  const t = useTranslations('Stock');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const search = useDeferredValue(query.trim().toLocaleLowerCase());
  const counts = Object.fromEntries(FILTERS.map((key) => [key, 0])) as Record<Filter, number>;
  for (const medicine of medicines) {
    const status = stockStatus(medicine);
    counts[status] += 1;
    if (status !== 'archived') counts.all += 1;
  }
  const visible = medicines.filter((medicine) => {
    const status = stockStatus(medicine);
    const inFilter = filter === 'all' ? status !== 'archived' : status === filter;
    return inFilter && `${medicine.name} ${medicine.code ?? ''}`.toLocaleLowerCase().includes(search);
  });
  const active = medicines.filter(({isActive}) => isActive);
  const units = active.reduce((sum, {currentStock}) => sum + currentStock, 0);
  const stockValue = active.reduce((sum, {currentStock, sellingPrice}) => sum.plus(new Decimal(sellingPrice).times(currentStock)), new Decimal(0));

  return (
    <section className="catalog">
      <div className="catalog-stats" role="group" aria-label={t('statTotal')}>
        {STAT_CARDS.map(({key, label}) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`catalog-stat is-${key}`}>
            <span>{t(label)}</span>
            <strong>{counts[key]}</strong>
          </button>
        ))}
      </div>
      <div className="catalog-value">
        <span>{t('stockValue')}</span>
        <b dir="ltr">{amountFormat.format(stockValue.toNumber())} <small>MRU</small></b>
        <small>· {t('stockCount', {count: units})}</small>
      </div>
      <div className="catalog-toolbar">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')} />
        </label>
        <button type="button" className="archived-toggle" aria-pressed={filter === 'archived'} aria-label={t('filterArchived')} onClick={() => setFilter(filter === 'archived' ? 'all' : 'archived')}>
          <Archive size={16} aria-hidden="true" /><span className="archived-label">{t('filterArchived')}</span><span className="archived-count">{counts.archived}</span>
        </button>
      </div>
      {visible.length ? (
        <div className="medicine-rows">
          {visible.map((medicine) => (
            <MedicineRow key={medicine.id} medicine={medicine} locale={locale} />
          ))}
        </div>
      ) : (
        <p className="catalog-empty">{medicines.length ? t('noResults') : t('emptyCatalog')}</p>
      )}
    </section>
  );
}
