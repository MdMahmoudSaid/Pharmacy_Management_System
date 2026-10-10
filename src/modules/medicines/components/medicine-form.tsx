'use client';

import {ChevronDown} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {createMedicineAction, type MedicineActionState} from '../actions';

export function MedicineForm({locale}: {locale: 'ar' | 'fr'}) {
  const t = useTranslations('Stock');
  const [state, action, pending] = useActionState<MedicineActionState, FormData>(createMedicineAction, undefined);
  // A new key after each success clears the form; a failed attempt keeps what was typed.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setFormKey((key) => key + 1);
  }
  return (
    <details className="form-collapse">
      <summary><span>{t('addMedicine')}</span><ChevronDown size={20} aria-hidden="true" /></summary>
      <form key={formKey} action={action} className="entry-form" data-testid="medicine-form">
        <input type="hidden" name="locale" value={locale} />
        <label><span>{t('name')}</span><input name="name" minLength={2} maxLength={160} required /></label>
        <label><span>{t('code')}</span><input name="code" maxLength={80} dir="ltr" /></label>
        <label><span>{t('priceMru')}</span><input name="sellingPrice" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" dir="ltr" required /></label>
        <label><span>{t('minStock')}</span><input name="minStock" type="number" min="0" step="1" defaultValue={5} dir="ltr" required /></label>
        <div className="entry-footer">
          <button className="primary-action" disabled={pending}>{t('create')}</button>
          {state && !state.ok ? <p className="form-error" role="alert">{t(`errors.${state.code}`)}</p> : null}
          {state?.ok ? <p className="form-success" role="status">{t('created')}</p> : null}
        </div>
      </form>
    </details>
  );
}
