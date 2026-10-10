'use client';
import {useDeferredValue, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';
import {
  archiveMedicineAction,
  restoreMedicineAction,
  updateMedicineAction,
  type MedicineActionState
} from '../actions';

type Medicine = {id: number; name: string; code: string | null; sellingPrice: string; currentStock: number; isActive: boolean};

function MedicineCard({medicine, locale, canEdit, canArchive}: {medicine: Medicine; locale: 'ar' | 'fr'; canEdit: boolean; canArchive: boolean}) {
  const t = useTranslations('Stock');
  const [editState, editAction] = useActionState<MedicineActionState, FormData>(updateMedicineAction, undefined);
  const activeAction = medicine.isActive ? archiveMedicineAction : restoreMedicineAction;
  const [activeState, stateAction] = useActionState<MedicineActionState, FormData>(activeAction, undefined);
  return (
    <article className="medicine-card">
      <div><strong>{medicine.name}</strong><p>{medicine.code ?? '—'} · {medicine.currentStock} {t('units')}</p></div>
      <b>{medicine.sellingPrice}</b>
      {canEdit ? <details>
        <summary>{t('edit')}</summary>
        <form action={editAction} className="compact-grid-form">
          <input type="hidden" name="id" value={medicine.id} /><input type="hidden" name="locale" value={locale} />
          <input name="name" defaultValue={medicine.name} required /><input name="code" defaultValue={medicine.code ?? ''} />
          <input name="sellingPrice" defaultValue={medicine.sellingPrice} required /><input name="reason" placeholder={t('priceReason')} />
          {editState && !editState.ok ? <small>{editState.code}</small> : null}<button>{t('save')}</button>
        </form>
      </details> : null}
      {canArchive ? <form action={stateAction} className="inline-sensitive-form">
        <input type="hidden" name="id" value={medicine.id} /><input type="hidden" name="locale" value={locale} />
        <input name="reason" placeholder={t('reason')} required />
        {activeState && !activeState.ok ? <small>{activeState.code}</small> : null}
        <button className={medicine.isActive ? 'danger-action' : 'secondary-action'}>{medicine.isActive ? t('archive') : t('restore')}</button>
      </form> : null}
    </article>
  );
}

export function MedicineList({medicines, locale, canEdit, canArchive}: {medicines: Medicine[]; locale: 'ar' | 'fr'; canEdit: boolean; canArchive: boolean}) {
  const t = useTranslations('Stock');
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.toLocaleLowerCase());
  const visible = medicines.filter((item) => `${item.name} ${item.code ?? ''}`.toLocaleLowerCase().includes(deferred));
  return <section className="catalog-list"><input className="search-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} />{visible.map((item) => <MedicineCard key={item.id} medicine={item} locale={locale} canEdit={canEdit} canArchive={canArchive} />)}</section>;
}
