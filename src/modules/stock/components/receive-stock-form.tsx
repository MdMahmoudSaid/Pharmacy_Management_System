'use client';

import {ChevronDown} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import {SearchSelect} from '@/components/search-select';
import {receiveStockAction, type StockActionState} from '../actions';

export function ReceiveStockForm({medicines, locale}: {
  medicines: Array<{id: number; name: string; currentStock: number}>;
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Stock');
  const [state, action, pending] = useActionState<StockActionState, FormData>(receiveStockAction, undefined);
  // A new key after each success clears the form; a failed attempt keeps what was typed.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setFormKey((key) => key + 1);
  }
  return (
    <details className="form-collapse">
      <summary><span>{t('receive')}</span><ChevronDown size={20} aria-hidden="true" /></summary>
      <ConfirmForm key={formKey} action={action} className="entry-form" data-testid="receive-stock-form" message={t('receiveConfirm')}>
        <input type="hidden" name="locale" value={locale} />
        <div className="entry-field">
          <span>{t('medicine')}</span>
          <SearchSelect
            name="medicineId"
            options={medicines.map(({id, name, currentStock}) => ({id, label: name, hint: t('stockCount', {count: currentStock})}))}
            label={t('medicine')}
            placeholder={t('medicinePlaceholder')}
            emptyText={t('noMedicines')}
            noMatchText={t('noMedicineMatch')}
            invalidText={t('pickMedicine')}
          />
        </div>
        <label><span>{t('quantity')}</span><input name="quantity" type="number" min="1" step="1" dir="ltr" required /></label>
        <label><span>{t('note')}</span><input name="note" maxLength={500} /></label>
        <div className="entry-footer">
          <button className="primary-action" disabled={pending}>{t('confirmReceive')}</button>
          {state && !state.ok ? <p className="form-error" role="alert">{t(`errors.${state.code}`)}</p> : null}
          {state?.ok ? <p className="form-success" role="status">{t('received')}</p> : null}
        </div>
      </ConfirmForm>
    </details>
  );
}
