'use client';

import Decimal from 'decimal.js';
import {ChevronDown, Plus, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import {SearchSelect} from '@/components/search-select';
import {receiveStockBatchAction, type StockActionState} from '../actions';
import {projectReceiptPricing} from '../pricing';

type Medicine = {id: number; name: string; currentStock: number; averageCost: string; sellingPrice: string};
type Line = {key: number; medicineId: number | null; quantity: string; totalCost: string; price: string; priceEdited: boolean};

const emptyLine = (key: number): Line => ({key, medicineId: null, quantity: '', totalCost: '', price: '', priceEdited: false});
// Wrapped so "48.11 MRU" keeps its order inside an Arabic sentence.
const inline = (value: Decimal.Value) => `\u2066${money(value)} MRU\u2069`;
const money = (value: Decimal.Value) =>
  new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(value));

// What a line works out to once the medicine, the quantity and the total paid are known.
function analyse(line: Line, medicine: Medicine | undefined) {
  const quantity = Number(line.quantity);
  const total = Number(line.totalCost);
  if (!medicine || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(total) || total <= 0) return null;
  const projection = projectReceiptPricing({
    currentStock: medicine.currentStock,
    averageCost: medicine.averageCost,
    quantity,
    totalCost: line.totalCost
  });
  const current = new Decimal(medicine.sellingPrice || 0);
  const suggested = new Decimal(projection.suggestedSellingPrice);
  // The higher of the two is offered first, so a price that is already good is never lowered by mistake.
  const offered = Decimal.max(current, suggested);
  const price = line.priceEdited ? line.price : offered.toFixed(2);
  const priceValue = /^\d+(?:\.\d{1,2})?$/.test(price) ? new Decimal(price) : null;
  // Judged against what was just paid per unit when that is higher than the running average.
  const average = new Decimal(projection.referenceCost);
  const profit = priceValue ? priceValue.minus(average) : null;
  return {
    quantity,
    projection,
    current,
    suggested,
    price,
    profit,
    margin: profit && !average.isZero() ? profit.dividedBy(average).times(100) : null,
    // The server refuses a price that does not exceed the average cost.
    valid: priceValue !== null && profit !== null && profit.greaterThan(0)
  };
}

export function ReceiveStockForm({medicines, suppliers, locale}: {
  medicines: Medicine[];
  suppliers: Array<{id: number; name: string}>;
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Stock');
  const [state, action, pending] = useActionState<StockActionState, FormData>(receiveStockBatchAction, undefined);
  // A new key after each success clears the form; a failed attempt keeps what was typed.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [nextKey, setNextKey] = useState(1);
  const [lines, setLines] = useState<Line[]>([emptyLine(0)]);

  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) {
      setFormKey((key) => key + 1);
      setSupplierId(null);
      setNote('');
      setNextKey(1);
      setLines([emptyLine(0)]);
    }
  }

  const update = (key: number, changes: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? {...line, ...changes} : line)));
  const analysed = lines.map((line) => ({line, medicine: medicines.find(({id}) => id === line.medicineId)}))
    .map((entry) => ({...entry, result: analyse(entry.line, entry.medicine)}));
  const picked = lines.map(({medicineId}) => medicineId).filter((id) => id !== null);
  const duplicate = (id: number | null) => id !== null && picked.filter((value) => value === id).length > 1;
  const ready = supplierId !== null
    && analysed.every(({result, line}) => result?.valid && !duplicate(line.medicineId));
  const invoiceTotal = analysed.reduce((sum, {result}) => sum.plus(result?.projection.totalCost ?? 0), new Decimal(0));
  const payload = JSON.stringify({
    supplierId,
    note,
    lines: analysed.map(({line, result}) => ({
      medicineId: line.medicineId,
      quantity: Number(line.quantity),
      totalCost: line.totalCost,
      sellingPrice: result?.price ?? ''
    }))
  });

  return (
    <details className="form-collapse">
      <summary><span>{t('receive')}</span><ChevronDown size={20} aria-hidden="true" /></summary>
      <ConfirmForm key={formKey} action={action} className="entry-form rcv-form" data-testid="receive-stock-form" message={t('receiveConfirm', {count: lines.length})}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="payload" value={payload} />
        <div className="rcv-head">
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
              onValueChange={setSupplierId}
            />
          </div>
          <label><span>{t('note')}</span><input aria-label={t('note')} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder={t('invoiceNotePlaceholder')} /></label>
        </div>

        <ol className="rcv-lines">
          {analysed.map(({line, medicine, result}, index) => (
            <li key={line.key} className="rcv-line">
              <div className="rcv-line-top">
                <b className="rcv-line-number" aria-hidden="true">{index + 1}</b>
                <div className="entry-field rcv-medicine">
                  <span>{t('medicine')}</span>
                  <SearchSelect
                    name={`medicineId-${line.key}`}
                    options={medicines.map(({id, name, currentStock}) => ({id, label: name, hint: t('stockCount', {count: currentStock})}))}
                    label={t('medicine')}
                    placeholder={t('medicinePlaceholder')}
                    emptyText={t('noMedicines')}
                    noMatchText={t('noMedicineMatch')}
                    invalidText={t('pickMedicine')}
                    onValueChange={(id) => update(line.key, {medicineId: id, priceEdited: false})}
                  />
                  {duplicate(line.medicineId) ? <small className="field-warning">{t('duplicateMedicine')}</small> : null}
                </div>
                {lines.length > 1 ? (
                  <button type="button" className="icon-action rcv-remove" aria-label={t('removeLine')} onClick={() => setLines((current) => current.filter(({key}) => key !== line.key))}><X size={18} /></button>
                ) : null}
              </div>
              <div className="rcv-amounts">
                <label><span>{t('quantity')}</span><input name="quantity" type="number" min="1" step="1" dir="ltr" value={line.quantity} onChange={(event) => update(line.key, {quantity: event.target.value, priceEdited: false})} required /></label>
                <label><span>{t('amountPaid')}</span><input aria-label={t('amountPaid')} name="totalCost" inputMode="decimal" dir="ltr" value={line.totalCost} onChange={(event) => update(line.key, {totalCost: event.target.value, priceEdited: false})} required /></label>
                <div className="rcv-unit" aria-live="polite"><small>{t('unitCostComputed')}</small><strong dir="ltr">{result ? `${money(result.projection.unitCost)} MRU` : '—'}</strong></div>
              </div>

              {result && medicine ? (
                <div className="rcv-pricing">
                  <div className="rcv-prices">
                    <button type="button" className={`price-chip${result.price === result.current.toFixed(2) ? ' is-picked' : ''}`} onClick={() => update(line.key, {price: result.current.toFixed(2), priceEdited: true})}>
                      <small>{t('currentPrice')}</small><b dir="ltr">{money(result.current)}</b>
                    </button>
                    <button type="button" className={`price-chip${result.price === result.suggested.toFixed(2) ? ' is-picked' : ''}`} onClick={() => update(line.key, {price: result.suggested.toFixed(2), priceEdited: true})}>
                      <small>{t('suggestedPrice')}</small><b dir="ltr">{money(result.suggested)}</b>
                    </button>
                    <label className="price-input"><span>{t('newSellingPrice')}</span>
                      <input aria-label={t('newSellingPrice')} name="sellingPrice" inputMode="decimal" dir="ltr" value={result.price} onChange={(event) => update(line.key, {price: event.target.value, priceEdited: true})} required />
                    </label>
                  </div>
                  <p className={`rcv-result ${result.valid ? 'is-profit' : 'is-loss'}`} aria-live="polite">
                    {result.profit && result.valid
                      ? <><b>{t('profitPerUnit')}</b> <span dir="ltr">+{money(result.profit)} MRU{result.margin ? ` · ${result.margin.toFixed(0)}%` : ''}</span></>
                      : <><b>{t('lossPerUnit')}</b> <span>{t('priceBelowCost', {cost: inline(result.projection.referenceCost)})}</span></>}
                  </p>
                  {medicine.currentStock > 0 ? <small className="rcv-average">{t('averageAfter', {cost: inline(result.projection.projectedAverageCost)})}</small> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <button type="button" className="add-line" onClick={() => {setLines((current) => [...current, emptyLine(nextKey)]); setNextKey((key) => key + 1);}}>
          <Plus size={17} aria-hidden="true" />{t('addLine')}
        </button>

        <div className="rcv-footer">
          <div className="rcv-total"><small>{t('invoiceTotal')}</small><strong dir="ltr">{money(invoiceTotal)} MRU</strong><small>{t('invoiceTotalHint')}</small></div>
          <button className="primary-action" disabled={pending || !ready}>{t('confirmReceive')}</button>
        </div>
        {state && !state.ok ? <p className="form-error" role="alert">{t(`errors.${state.code}`)}</p> : null}
        {state?.ok ? <p className="form-success" role="status">{t('received')}</p> : null}
      </ConfirmForm>
    </details>
  );
}
