'use client';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';
import {createMedicineAction, type MedicineActionState} from '../actions';

export function MedicineForm({locale}: {locale: 'ar' | 'fr'}) {
  const t = useTranslations('Stock');
  const [state, action, pending] = useActionState<MedicineActionState, FormData>(
    createMedicineAction,
    undefined
  );
  return (
    <form action={action} className="entity-form" data-testid="medicine-form">
      <input type="hidden" name="locale" value={locale} />
      <strong>{t('newMedicine')}</strong>
      <label><span>{t('name')}</span><input name="name" required /></label>
      <label><span>{t('code')}</span><input name="code" /></label>
      <label><span>{t('price')}</span><input name="sellingPrice" inputMode="decimal" required /></label>
      {state && !state.ok ? <p className="form-error">{state.code}</p> : null}
      <button className="primary-action" disabled={pending}>{t('create')}</button>
    </form>
  );
}
