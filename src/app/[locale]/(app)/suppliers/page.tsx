import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {SupplierForm} from '@/modules/suppliers/components/supplier-form';
import {SupplierList} from '@/modules/suppliers/components/supplier-list';
import {listSuppliers} from '@/modules/suppliers/queries';

export default async function SuppliersPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const [t, data] = await Promise.all([getTranslations('Suppliers'), listSuppliers(actor, {includeArchived: true})]);
  return <main className="page-content suppliers-page"><header className="page-heading"><p>{t('kicker')}</p><h1>{t('title')}</h1><span>{t('subtitle')}</span></header><section className="supplier-summary"><article className="is-debt"><span>{t('totalDebt')}</span><strong dir="ltr">{data.totals.debt} MRU</strong></article><article><span>{t('totalAdvances')}</span><strong dir="ltr">{data.totals.advances} MRU</strong></article><article><span>{t('totalPurchases')}</span><strong dir="ltr">{data.totals.purchases} MRU</strong></article><article><span>{t('totalPayments')}</span><strong dir="ltr">{data.totals.payments} MRU</strong></article></section>{can(actor, 'suppliers.manage.all') ? <SupplierForm locale={locale} /> : null}<SupplierList rows={data.items} locale={locale} /></main>;
}
