'use client';

import {ChevronDown} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useMemo, useState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import {SearchSelect} from '@/components/search-select';
import {receiveStockAction, type StockActionState} from '../actions';
import {projectReceiptPricing} from '../pricing';

export function ReceiveStockForm({medicines, suppliers, locale}: {
  medicines: Array<{id: number; name: string; currentStock: number; averageCost: string; sellingPrice: string}>;
  suppliers: Array<{id: number; name: string}>;
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Stock');
  const [state, action, pending] = useActionState<StockActionState, FormData>(receiveStockAction, undefined);
  // A new key after each success clears the form; a failed attempt keeps what was typed.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  const [medicineId, setMedicineId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [priceEdited, setPriceEdited] = useState(false);
  const selectedMedicine = medicines.find(({id}) => id === medicineId);
  const projection = useMemo(() => {
    const count = Number(quantity);
    const cost = Number(unitCost);
    if (!selectedMedicine || !Number.isInteger(count) || count <= 0 || !Number.isFinite(cost) || cost <= 0) return null;
    return projectReceiptPricing({
      currentStock: selectedMedicine.currentStock,
      averageCost: selectedMedicine.averageCost,
      quantity: count,
      unitCost
    });
  }, [quantity, selectedMedicine, unitCost]);
  const displayedSellingPrice = priceEdited ? sellingPrice : projection?.suggestedSellingPrice ?? sellingPrice;
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) {
      setFormKey((key) => key + 1);
      setMedicineId(null);
      setQuantity('');
      setUnitCost('');
      setSellingPrice('');
      setPriceEdited(false);
    }
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
            onValueChange={(id) => {
              setMedicineId(id);
              setPriceEdited(false);
            }}
          />
        </div>
        <div className="entry-field">
          <span>{t('supplier')}</span>
          <SearchSelect
            name="supplierId"
            options={suppliers.map(({id, name}) => ({id, label: name}))}
            label={t('supplier')}
            placeholder={t('supplierPlaceholder')}
            emptyText={t('noSuppliers')}
            noMatchText={t('noSupplierMatch')}
            invalidText={t('pickSupplier')}
          />
        </div>
        <label><span>{t('quantity')}</span><input name="quantity" type="number" min="1" step="1" dir="ltr" value={quantity} onChange={(event) => {setQuantity(event.target.value); setPriceEdited(false);}} required /></label>
        <label><span>{t('unitCost')}</span><input aria-label={t('unitCost')} name="unitCost" inputMode="decimal" dir="ltr" value={unitCost} onChange={(event) => {setUnitCost(event.target.value); setPriceEdited(false);}} required /></label>
        {projection ? (
          <div className="receipt-projection" aria-live="polite">
            <span><small>{t('totalCost')}</small><strong>{projection.totalCost} MRU</strong></span>
            <span><small>{t('projectedAverageCost')}</small><strong>{projection.projectedAverageCost} MRU</strong></span>
            <span><small>{t('suggestedSellingPrice')}</small><strong>{projection.suggestedSellingPrice} MRU</strong></span>
          </div>
        ) : null}
        <label>
          <span>{t('newSellingPrice')}</span>
          <input aria-label={t('newSellingPrice')} name="sellingPrice" inputMode="decimal" dir="ltr" value={displayedSellingPrice} onChange={(event) => {setSellingPrice(event.target.value); setPriceEdited(true);}} required />
          {projection ? <small className="field-help">{t('sellingPriceHelp', {cost: projection.projectedAverageCost})}</small> : null}
        </label>
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
