'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {recordSupplierDebtAction, recordSupplierPaymentAction, type SupplierActionState} from '../actions';

type LedgerRow = {
  kind: 'RECEIPT' | 'PAYMENT' | 'DEBT';
  id: number;
  occurredAt: Date;
  amount: string;
  runningBalance: string;
  medicineId: number | null;
  medicineName: string | null;
  quantity: number | null;
  unitCost: string | null;
  reference: string | null;
  note: string | null;
};

const amount = (value: string) => `${Number(value).toFixed(2)} MRU`;

export function SupplierLedger({rows, locale}: {supplierId: number; rows: LedgerRow[]; locale: 'ar' | 'fr'; canPay: boolean}) {
  const t = useTranslations('Suppliers');
  const date = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'Africa/Nouakchott'});
  return (
    <>
      <section className="ledger-panel">
        <h2>{t('ledger')}</h2>
        <div className="ledger-scroll">
          <table className="financial-ledger">
            <thead><tr><th>{t('date')}</th><th>{t('operation')}</th><th>{t('debit')}</th><th>{t('credit')}</th><th>{t('runningBalance')}</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={`${row.kind}-${row.id}`}>
              <td data-label={t('date')}>{date.format(new Date(row.occurredAt))}</td>
              <td data-label={t('operation')}>{row.kind === 'RECEIPT' ? <Link href={`/${locale}/medicines/${row.medicineId}`}>{row.medicineName} · {row.quantity} × {row.unitCost}</Link> : row.kind === 'DEBT' ? t('previousDebt') : row.reference || t('payment')} {row.note ? <small>{row.note}</small> : null}</td>
              <td data-label={t('debit')} dir="ltr">{row.kind !== 'PAYMENT' ? amount(row.amount) : '—'}</td>
              <td data-label={t('credit')} dir="ltr">{row.kind === 'PAYMENT' ? amount(row.amount) : '—'}</td>
              <td data-label={t('runningBalance')} dir="ltr"><b>{amount(row.runningBalance)}</b></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!rows.length ? <p className="catalog-empty">{t('emptyLedger')}</p> : null}
      </section>
    </>
  );
}

export function SupplierPaymentForm({supplierId, locale}: {supplierId: number; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Suppliers');
  const [state, action, pending] = useActionState<SupplierActionState, FormData>(recordSupplierPaymentAction, undefined);
  return <form action={action} className="entry-form payment-form-body">
    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="supplierId" value={supplierId} />
    <label><span>{t('paymentAmount')}</span><input aria-label={t('paymentAmount')} name="amount" inputMode="decimal" required /></label>
    <label><span>{t('paymentDate')}</span><input name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
    <label><span>{t('reference')}</span><input name="reference" /></label>
    <label><span>{t('note')}</span><input name="note" /></label>
    <div className="entry-footer"><button className="primary-action" disabled={pending}>{t('recordPayment')}</button>{state && !state.ok ? <p className="form-error">{t(`errors.${state.code}`)}</p> : null}{state?.ok ? <p className="form-success">{t('paymentSaved')}</p> : null}</div>
  </form>;
}

export function SupplierDebtForm({supplierId, locale}: {supplierId: number; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Suppliers');
  const [state, action, pending] = useActionState<SupplierActionState, FormData>(recordSupplierDebtAction, undefined);
  return <form action={action} className="entry-form payment-form-body">
    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="supplierId" value={supplierId} />
    <p className="dialog-hint">{t('debtHint')}</p>
    <label><span>{t('debtAmount')}</span><input aria-label={t('debtAmount')} name="amount" inputMode="decimal" dir="ltr" required /></label>
    <label><span>{t('debtDate')}</span><input name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
    <label><span>{t('note')}</span><input name="note" placeholder={t('debtNotePlaceholder')} /></label>
    <div className="entry-footer"><button className="primary-action" disabled={pending}>{t('recordDebt')}</button>{state && !state.ok ? <p className="form-error">{t(`errors.${state.code}`)}</p> : null}{state?.ok ? <p className="form-success">{t('debtSaved')}</p> : null}</div>
  </form>;
}
