'use client';

import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {adjustStockAction, type StockActionState} from '../actions';

export function AdjustStockForm({medicineId, locale}: {medicineId: number; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Stock');
  const [state, action, pending] = useActionState<StockActionState, FormData>(adjustStockAction, undefined);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [quantity, setQuantity] = useState('');
  return (
      <form action={action} className="entry-form adjustment-form-body">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="medicineId" value={medicineId} />
        <input type="hidden" name="quantityChange" value={quantity ? Number(quantity) * direction : ''} />
        <div className="stock-direction" role="group" aria-label={t('quantityChange')}>
          <button type="button" className={direction === 1 ? 'is-active is-add' : ''} aria-pressed={direction === 1} onClick={() => setDirection(1)}>+ <span>{t('addStock')}</span></button>
          <button type="button" className={direction === -1 ? 'is-active is-remove' : ''} aria-pressed={direction === -1} onClick={() => setDirection(-1)}>− <span>{t('removeStock')}</span></button>
        </div>
        <label><span>{t('quantity')}</span><input aria-label={t('quantity')} value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min="1" step="1" required /></label>
        <label><span>{t('adjustmentReason')}</span><input aria-label={t('adjustmentReason')} name="reason" minLength={3} required /></label>
        <div className="entry-footer"><button className="primary-action" disabled={pending}>{t('recordAdjustment')}</button>{state && !state.ok ? <p className="form-error">{t(`errors.${state.code}`)}</p> : null}{state?.ok ? <p className="form-success">{t('adjusted')}</p> : null}</div>
      </form>
  );
}
