import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {authorize, can} from '@/modules/permissions/service';
import {listMedicines} from '@/modules/medicines/queries';
import {MedicineForm} from '@/modules/medicines/components/medicine-form';
import {MedicineList} from '@/modules/medicines/components/medicine-list';
import {parseMedicineFilter} from '@/modules/medicines/filters';

export default async function MedicinesPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{filter?: string}>}) {
  const {locale} = await params;if (!hasLocale(routing.locales, locale)) notFound();setRequestLocale(locale);
  const actor = await requireSession();authorize(actor, 'medicines.view.all');
  const [t, rows, {filter}] = await Promise.all([getTranslations('Stock'), listMedicines(), searchParams]);
  return <main className="page-content catalog-page"><header className="page-heading"><p>{t('catalogKicker')}</p><h1>{t('catalogTitle')}</h1><span>{t('catalogSubtitle')}</span></header>{can(actor, 'medicines.create.all') ? <MedicineForm locale={locale} /> : null}<MedicineList key={filter ?? 'all'} medicines={rows} locale={locale} initialFilter={parseMedicineFilter(filter)} canEdit={can(actor, 'medicines.update.all')} canArchive={can(actor, 'medicines.archive.all') || can(actor, 'medicines.restore.all')} /></main>;
}
