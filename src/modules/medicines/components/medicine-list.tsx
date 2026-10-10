'use client';

import {Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useDeferredValue, useState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import {
  archiveMedicineAction,
  restoreMedicineAction,
  updateMedicineAction,
  type MedicineActionState
} from '../actions';

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
const FILTERS = ['all', 'available', 'low', 'out', 'archived'] as const;
type Filter = (typeof FILTERS)[number];
const filterLabel = {all: 'filterAll', available: 'filterAvailable', low: 'filterLow', out: 'filterOut', archived: 'filterArchived'} as const;

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

export function MedicineList({medicines, locale, canEdit, canArchive}: {
  medicines: Medicine[];
  locale: 'ar' | 'fr';
  canEdit: boolean;
  canArchive: boolean;
}) {
  const t = useTranslations('Stock');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
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

  return (
    <section className="catalog">
      <div className="catalog-toolbar">
        <label className="search-box">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')} />
        </label>
        <div className="filter-pills" role="group" aria-label={t('filterAll')}>
          {FILTERS.map((key) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`is-${key}`}>
              {t(filterLabel[key])}<span>{counts[key]}</span>
            </button>
          ))}
        </div>
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
