'use client';

import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {
  createSupplierAction,
  setSupplierActiveAction,
  updateSupplierAction,
  type SupplierActionState
} from '../actions';
import {ConfirmForm} from '@/components/confirm-form';

type SupplierValues = {
  id: number;
  name: string;
  phone: string | null;
  contactPerson: string | null;
  address: string | null;
  note: string | null;
};

export function SupplierForm({locale, supplier, embedded = false}: {locale: 'ar' | 'fr'; supplier?: SupplierValues; embedded?: boolean}) {
  const t = useTranslations('Suppliers');
  const action = supplier ? updateSupplierAction : createSupplierAction;
  const [state, submit, pending] = useActionState<SupplierActionState, FormData>(action, undefined);
  const form = <form action={submit} className="entry-form supplier-form-body">
        <input type="hidden" name="locale" value={locale} />
        {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
        <label><span>{t('name')}</span><input name="name" defaultValue={supplier?.name ?? ''} minLength={2} required /></label>
        <label><span>{t('phone')}</span><input name="phone" defaultValue={supplier?.phone ?? ''} dir="ltr" inputMode="tel" /></label>
        <label><span>{t('contactPerson')}</span><input name="contactPerson" defaultValue={supplier?.contactPerson ?? ''} /></label>
        <label><span>{t('address')}</span><input name="address" defaultValue={supplier?.address ?? ''} /></label>
        <label className="span-wide"><span>{t('note')}</span><textarea name="note" defaultValue={supplier?.note ?? ''} rows={3} /></label>
        <div className="entry-footer">
          <button className="primary-action" disabled={pending}>{supplier ? t('save') : t('create')}</button>
          {state && !state.ok ? <p className="form-error" role="alert">{t(`errors.${state.code}`)}</p> : null}
          {state?.ok ? <p className="form-success" role="status">{t('saved')}</p> : null}
        </div>
      </form>;
  if (embedded) return form;
  return (
    <details className="form-collapse supplier-form">
      <summary>{supplier ? t('edit') : t('new')}</summary>
      {form}
    </details>
  );
}

export function SupplierStatusForm({locale, id, active, disabled}: {locale: 'ar' | 'fr'; id: number; active: boolean; disabled?: boolean}) {
  const t = useTranslations('Suppliers');
  const [state, action, pending] = useActionState<SupplierActionState, FormData>(setSupplierActiveAction, undefined);
  return <ConfirmForm action={action} className="status-form" message={t(active ? 'archiveConfirm' : 'restoreConfirm')}>
    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} />
    <button className={active ? 'danger-action' : 'secondary-action'} disabled={pending || disabled}>{t(active ? 'archive' : 'restore')}</button>
    {state && !state.ok ? <small className="form-error">{t(`errors.${state.code}`)}</small> : null}
  </ConfirmForm>;
}
