import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {nouakchottRange, type ReportPreset} from '@/lib/time';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {ReportTabs} from '@/modules/reports/components/report-tabs';
import {getReportData} from '@/modules/reports/queries';
import {reportPresetSchema} from '@/modules/reports/schemas';

const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';

export default async function ReportsPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const query = await searchParams;
  const presetResult = reportPresetSchema.safeParse(text(query.preset) || 'today');
  const preset: ReportPreset = presetResult.success ? presetResult.data : 'today';
  const customFrom = text(query.from);
  const customTo = text(query.to);
  const range = customFrom && customTo
    ? {from: new Date(`${customFrom}T00:00:00.000Z`), to: new Date(`${customTo}T00:00:00.000Z`)}
    : nouakchottRange(preset);
  const [t, data] = await Promise.all([getTranslations('Reports'), getReportData(actor, range)]);
  return (
    <main className="page-content reports-page">
      <header className="page-heading"><p>{t('kicker')}</p><h1>{t('title')}</h1><span>{t('subtitle')}</span></header>
      <form className="report-filters no-print">
        <select name="preset" defaultValue={preset}>{(['today', 'yesterday', 'this_week', 'this_month'] as const).map((key) => <option value={key} key={key}>{t(key)}</option>)}</select>
        <input type="date" name="from" defaultValue={customFrom} aria-label={t('from')} />
        <input type="date" name="to" defaultValue={customTo} aria-label={t('toExclusive')} />
        <button className="secondary-action">{t('apply')}</button>
      </form>
      <ReportTabs data={data} canPrint={can(actor, 'reports.print.own', actor.id)} />
    </main>
  );
}
