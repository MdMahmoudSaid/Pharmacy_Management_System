'use client';

import Decimal from 'decimal.js';
import {Archive, Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useDeferredValue, useState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import {
  archiveMedicineAction,
  restoreMedicineAction,
  updateMedicineAction,
  type MedicineActionState
} from '../actions';
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

function MedicineRow({medicine, locale, canEdit, canArchive}: {
  medicine: Medicine;
  locale: 'ar' | 'fr';
  canEdit: boolean;
  canArchive: boolean;
}) {
  const t = useTranslations('Stock');
  const [editState, editAction, saving] = useActionState<MedicineActionState, FormData>(updateMedicineAction, undefined);
  const activeAction = medicine.isActive ? archiveMedicineAction : restoreMedicineAction;
  const [activeState, stateAction, switching] = useActionState<MedicineActionState, FormData>(activeAction, undefined);
  const status = stockStatus(medicine);
  return (
    <article className={`medicine-row is-${status}`}>
      <div className="medicine-row-main">
        <strong>{medicine.name}</strong>
        {medicine.code ? <small><bdi>{medicine.code}</bdi></small> : null}
      </div>
      <span className={`stock-badge is-${status}`}>
        {status === 'archived' ? t('filterArchived') : t('stockCount', {count: medicine.currentStock})}
      </span>
      <b dir="ltr">{amountFormat.format(Number(medicine.sellingPrice))} <small>MRU</small></b>
      {canEdit || canArchive ? (
        <details className="medicine-row-panel">
          <summary>{t('edit')}</summary>
          {canEdit && medicine.isActive ? (
            <form action={editAction} className="entry-form">
              <input type="hidden" name="id" value={medicine.id} />
              <input type="hidden" name="locale" value={locale} />
              <label><span>{t('name')}</span><input name="name" defaultValue={medicine.name} minLength={2} required /></label>
              <label><span>{t('codeLabel')}</span><input name="code" defaultValue={medicine.code ?? ''} dir="ltr" /></label>
              <label><span>{t('priceMru')}</span><input name="sellingPrice" defaultValue={medicine.sellingPrice} inputMode="decimal" dir="ltr" required /></label>
              <label><span>{t('minStock')}</span><input name="minStock" type="number" min="0" step="1" defaultValue={medicine.minStock} dir="ltr" required /></label>
              <label className="entry-field-wide"><span>{t('priceReasonHint')}</span><input name="reason" /></label>
              <div className="entry-footer">
                <button className="primary-action" disabled={saving}>{t('save')}</button>
                {editState && !editState.ok ? <small className="form-error" role="alert">{t(`errors.${editState.code}`)}</small> : null}
                {editState?.ok ? <small className="form-success" role="status">{t('saved')}</small> : null}
              </div>
            </form>
          ) : null}
          {canArchive ? (
            <ConfirmForm
              action={stateAction}
              className="medicine-archive-form"
              message={t(medicine.isActive ? 'archiveConfirm' : 'restoreConfirm', {name: medicine.name})}
            >
              <input type="hidden" name="id" value={medicine.id} />
              <input type="hidden" name="locale" value={locale} />
              <input name="reason" placeholder={t('reason')} aria-label={t('reason')} required />
              <button className={medicine.isActive ? 'danger-action' : 'secondary-action'} disabled={switching}>
                {medicine.isActive ? t('archive') : t('restore')}
              </button>
              {activeState && !activeState.ok ? <small className="form-error" role="alert">{t(`errors.${activeState.code}`)}</small> : null}
            </ConfirmForm>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}

export function MedicineList({medicines, locale, canEdit, canArchive, initialFilter = 'all'}: {
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
            <MedicineRow key={medicine.id} medicine={medicine} locale={locale} canEdit={canEdit} canArchive={canArchive} />
          ))}
        </div>
      ) : (
        <p className="catalog-empty">{medicines.length ? t('noResults') : t('emptyCatalog')}</p>
      )}
    </section>
  );
}
