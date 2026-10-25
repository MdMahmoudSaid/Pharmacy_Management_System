import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Archive, CreditCard, HandCoins, Pencil, RotateCcw} from 'lucide-react';

import {ActionDialog} from '@/components/action-dialog';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {SupplierForm, SupplierStatusForm} from '@/modules/suppliers/components/supplier-form';
import {SupplierDebtForm, SupplierLedger, SupplierPaymentForm} from '@/modules/suppliers/components/supplier-ledger';
import {getSupplierDetail} from '@/modules/suppliers/queries';

export default async function SupplierDetailPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (!hasLocale(routing.locales, locale) || !/^\d+$/.test(id)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const [t, detail] = await Promise.all([getTranslations('Suppliers'), getSupplierDetail(actor, Number(id)).catch(() => null)]);
  if (!detail) notFound();
  const balance = Number(detail.summary.balance);
  const canManage = can(actor, 'suppliers.manage.all');
  const canPay = can(actor, 'suppliers.pay.all') && detail.supplier.isActive;
  return <main className="page-content supplier-detail-page">
    <div className="detail-topbar"><Link className="back-link" href={`/${locale}/suppliers`}>{t('back')}</Link><div className="detail-actions">
      {canPay ? <ActionDialog title={t('addPayment')} trigger={<><CreditCard size={17} />{t('addPayment')}</>} triggerClass="primary-action"><SupplierPaymentForm supplierId={detail.supplier.id} locale={locale} /></ActionDialog> : null}
      {canManage && detail.supplier.isActive ? <ActionDialog title={t('recordDebt')} trigger={<><HandCoins size={17} />{t('recordDebt')}</>}><SupplierDebtForm supplierId={detail.supplier.id} locale={locale} /></ActionDialog> : null}
      {canManage ? <ActionDialog title={t('edit')} trigger={<><Pencil size={17} />{t('edit')}</>}><SupplierForm locale={locale} supplier={detail.supplier} embedded /></ActionDialog> : null}
      {canManage ? <ActionDialog title={t(detail.supplier.isActive ? 'archive' : 'restore')} trigger={<>{detail.supplier.isActive ? <Archive size={17} /> : <RotateCcw size={17} />}{t(detail.supplier.isActive ? 'archive' : 'restore')}</>} triggerClass={detail.supplier.isActive ? 'danger-outline-action' : 'secondary-action'}><SupplierStatusForm locale={locale} id={detail.supplier.id} active={detail.supplier.isActive} disabled={detail.supplier.isActive && balance !== 0} /></ActionDialog> : null}
    </div></div>
    <header className="entity-hero supplier-hero"><div><span className="supplier-avatar">{detail.supplier.name.charAt(0)}</span><div><p>{detail.supplier.isActive ? t('active') : t('archived')}</p><h1>{detail.supplier.name}</h1><span>{detail.supplier.phone || detail.supplier.contactPerson || t('noContact')}</span></div></div><strong className={balance > 0 ? 'balance-debt' : balance < 0 ? 'balance-advance' : ''} dir="ltr">{detail.summary.balance} MRU<small>{t(balance > 0 ? 'debt' : balance < 0 ? 'advance' : 'settled')}</small></strong></header>
    <section className="detail-stats supplier-detail-stats"><article><span>{t('purchases')}</span><strong dir="ltr">{detail.summary.purchases} MRU</strong></article>{Number(detail.summary.debts) > 0 ? <article><span>{t('previousDebts')}</span><strong dir="ltr">{detail.summary.debts} MRU</strong></article> : null}<article><span>{t('payments')}</span><strong dir="ltr">{detail.summary.payments} MRU</strong></article><article><span>{t('balance')}</span><strong dir="ltr">{detail.summary.balance} MRU</strong></article></section>
    <SupplierLedger supplierId={detail.supplier.id} rows={detail.ledger} locale={locale} canPay={canPay} />
  </main>;
}
