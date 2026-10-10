'use client';
import Decimal from 'decimal.js';
import {useTranslations} from 'next-intl';
import {useActionState, useEffect, useState} from 'react';
import {createSaleAction, type SaleActionState} from '../actions';
import {MedicineSearch, type SaleMedicine} from './medicine-search';
import {SaleCart, type CartItem} from './sale-cart';

export function SaleForm({
  medicines,
  shiftId,
  canOverride
}: {
  medicines: SaleMedicine[];
  shiftId: number;
  canOverride: boolean;
}) {
  const t = useTranslations('Sales');
  const [items, setItems] = useState<CartItem[]>([]);
  const [key, setKey] = useState('');
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, []);
  const [state, action, pending] = useActionState<SaleActionState, FormData>(
    async (_state, data) => {
      const result = await createSaleAction(undefined, data);
      if (result?.ok) {
        setItems([]);
        setKey('');
      }
      return result;
    },
    undefined
  );
  const add = (medicine: SaleMedicine) => {
    if (items.some(({id}) => id === medicine.id)) return;
    if (!key) setKey(crypto.randomUUID());
    setItems([...items, {...medicine, quantity: 1, unitPrice: medicine.sellingPrice, overrideReason: ''}]);
  };
  const total = items
    .reduce(
      (sum, item) => sum.plus(new Decimal(item.unitPrice || 0).times(item.quantity)),
      new Decimal(0)
    )
    .toFixed(2);
  const payload = items.map((item) => ({
    medicineId: item.id,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    overrideReason: item.overrideReason
  }));

  return (
    <form action={action} className="sale-layout">
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="idempotencyKey" value={key} data-testid="sale-idempotency-key" />
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <MedicineSearch medicines={medicines} onAdd={add} />
      <div className="sale-checkout">
        <SaleCart items={items} setItems={setItems} canOverride={canOverride} />
        {state && !state.ok ? (
          <p className="form-error" data-result={state.code}>
            {t(`errors.${state.code}`)}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="form-success" data-result="success">
            {t('success', {total: state.data.total})}
          </p>
        ) : null}
        {!online ? <p className="form-error" data-testid="offline-draft">{t('offlineDraft')}</p> : null}
        <div className="sale-total">
          <span>{t('total')}</span>
          <strong>{total}</strong>
          <button className="primary-action" disabled={pending || items.length === 0 || !online}>
            {pending ? t('processing') : t('confirm')}
          </button>
        </div>
      </div>
    </form>
  );
}
