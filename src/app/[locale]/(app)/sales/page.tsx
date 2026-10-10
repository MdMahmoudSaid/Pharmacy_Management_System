import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {DataState} from '@/components/data-state';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {searchMedicines} from '@/modules/medicines/service';
import {can} from '@/modules/permissions/service';
import {SaleForm} from '@/modules/sales/components/sale-form';
import {requireActiveShift} from '@/modules/shifts/service';

export default async function SalesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;if (!hasLocale(routing.locales, locale)) notFound();setRequestLocale(locale);
  const actor = await requireSession();const t = await getTranslations('Sales');
  let shift;try {shift = await requireActiveShift(actor.id);} catch {return <main className="page-content"><DataState title={t('shiftRequired')} description={t('shiftRequiredText')} /></main>;}
  const medicines = await searchMedicines();
  return <main className="page-content"><header className="page-heading"><p>{t('kicker')}</p><h1>{t('title')}</h1><span>{t('subtitle')}</span></header><SaleForm medicines={medicines} shiftId={shift.id} canOverride={can(actor, 'sales.price_override.all')} /></main>;
}
