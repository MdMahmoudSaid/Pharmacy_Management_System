import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {authorize} from '@/modules/permissions/service';
import {canOpenReport} from '@/modules/reports/builders';
import {REPORTS} from '@/modules/reports/catalog';
import {ReportCatalog} from '@/modules/reports/components/report-catalog';

export default async function ReportsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  authorize(actor, 'reports.view.own', actor.id);
  const t = await getTranslations('Reports');
  const visible = REPORTS.filter(({slug}) => canOpenReport(actor, slug)).map(({slug}) => slug);
  return (
    <main className="page-content reports-page">
      <header className="page-heading">
        <p>{t('kicker')}</p>
        <h1>{t('title')}</h1>
        <span>{t('subtitle')}</span>
      </header>
      <ReportCatalog locale={locale} visible={visible} />
    </main>
  );
}
