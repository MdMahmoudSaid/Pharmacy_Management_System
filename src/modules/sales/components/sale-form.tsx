'use client';
import Decimal from 'decimal.js';
import {CheckCircle2, Printer} from 'lucide-react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useActionState, useEffect, useState} from 'react';
import {createSaleAction, type SaleActionState} from '../actions';
import {formatMru, MedicineSearch, type SaleMedicine} from './medicine-search';
import {SaleCart, type CartItem} from './sale-cart';

export function SaleForm({
  medicines,
  shiftId,
  canOverride,
  locale
}: {
  medicines: SaleMedicine[];
  shiftId: number;
  canOverride: boolean;
  locale: 'ar' | 'fr';
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
    const existing = items.find(({id}) => id === medicine.id);
    if (existing) {
      if (existing.quantity >= medicine.currentStock) return;
      setItems(items.map((item) => (item.id === medicine.id ? {...item, quantity: item.quantity + 1} : item)));
      return;
    }
    if (medicine.currentStock < 1) return;
    if (!key) setKey(crypto.randomUUID());
    setItems([...items, {...medicine, quantity: 1, unitPrice: medicine.sellingPrice, overrideReason: ''}]);
  };
  const inCart = Object.fromEntries(items.map(({id, quantity}) => [id, quantity]));
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
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="idempotencyKey" value={key} data-testid="sale-idempotency-key" />
      <input type="hidden" name="items" value={JSON.stringify(payload)} />
      <MedicineSearch medicines={medicines} inCart={inCart} onAdd={add} />
      <div className="sale-checkout">
        <SaleCart items={items} setItems={setItems} canOverride={canOverride} />
        {state && !state.ok ? (
          <p className="form-error" data-result={state.code}>
            {t(`errors.${state.code}`)}
          </p>
        ) : null}
        {state?.ok && items.length === 0 ? (
          <div className="sale-success" data-result="success" role="status">
            <CheckCircle2 size={22} aria-hidden="true" />
            <p>{t('success', {total: formatMru(state.data.total)})}</p>
            <Link href={`/${locale}/sales/${state.data.id}`}><Printer size={16} aria-hidden="true" />{t('viewReceipt')}</Link>
          </div>
        ) : null}
        {!online ? <p className="form-error" data-testid="offline-draft">{t('offlineDraft')}</p> : null}
        <div className="sale-total">
          <span>{t('total')}</span>
          <strong dir="ltr">{formatMru(total)} <small>MRU</small></strong>
          <button className="primary-action" disabled={pending || items.length === 0 || !online}>
            {pending ? t('processing') : t('confirm')}
          </button>
        </div>
      </div>
    </form>
  );
}
