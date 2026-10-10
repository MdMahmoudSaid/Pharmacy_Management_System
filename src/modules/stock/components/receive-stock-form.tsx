'use client';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';
import {receiveStockAction, type StockActionState} from '../actions';

export function ReceiveStockForm({medicines, locale}: {medicines: Array<{id: number; name: string}>; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Stock');
  const [state, action, pending] = useActionState<StockActionState, FormData>(receiveStockAction, undefined);
  return (
    <form action={action} className="entity-form" data-testid="receive-stock-form" onSubmit={(event) => {if (!window.confirm(t('receiveConfirm'))) event.preventDefault();}}>
      <input type="hidden" name="locale" value={locale} /><strong>{t('receive')}</strong>
      <label><span>{t('medicine')}</span><select name="medicineId" required>{medicines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>{t('quantity')}</span><input className="quantity-input" name="quantity" type="number" min="1" step="1" required /></label>
      <label><span>{t('note')}</span><input name="note" /></label>
      {state && !state.ok ? <p className="form-error">{state.code}</p> : null}{state?.ok ? <p className="form-success">{t('received')}</p> : null}
      <button className="primary-action" disabled={pending}>{t('confirmReceive')}</button>
    </form>
  );
}
