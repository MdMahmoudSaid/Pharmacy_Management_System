import {ArrowLeft, ArrowRight} from 'lucide-react';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {canOpenReport, reportFilterOptions} from '@/modules/reports/builders';
import {reportNumber} from '@/modules/reports/catalog';
import {ReportActions} from '@/modules/reports/components/report-actions';
import {ReportDataTable, ReportSummary} from '@/modules/reports/components/report-document';
import {ReportFilterForm} from '@/modules/reports/components/report-filter-form';
import {ReportSheet} from '@/modules/reports/components/report-sheet';
import {formatDateTime} from '@/modules/reports/format';
import {loadReport} from '@/modules/reports/page-data';
import {REPORT_PRESETS} from '@/modules/reports/schemas';

export default async function ReportPage({params, searchParams}: {
  params: Promise<{locale: string; slug: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale, slug} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  if (!canOpenReport(actor, slug)) notFound();
  const [data, options, t] = await Promise.all([
    loadReport(actor, slug, await searchParams, locale),
    reportFilterOptions(actor),
    getTranslations('Reports')
  ]);
  if (!data) notFound();
  const {report, filters, result, duration} = data;
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;
  const canExport = can(actor, 'reports.print.own', actor.id);
  const issuedAt = formatDateTime(new Date());
  const applied = [
    filters.employeeId && report.filters.includes('employee')
      ? `${t('filters.employee')} : ${options.employees.find(({id}) => id === filters.employeeId)?.name ?? ''}`
      : null,
    filters.saleStatus && report.filters.includes('saleStatus') ? `${t('filters.status')} : ${t(`statuses.${filters.saleStatus}`)}` : null,
    filters.categoryId && report.filters.includes('category')
      ? `${t('filters.category')} : ${filters.categoryId === 'none' ? t('uncategorized') : options.categories.find(({id}) => id === filters.categoryId)?.name ?? ''}`
      : null,
    filters.movementType && report.filters.includes('movementType')
      ? `${t('filters.movementType')} : ${t(`movementTypes.${filters.movementType}` as 'movementTypes.SALE')}`
      : null,
    filters.stockLevel && report.filters.includes('stockLevel')
      ? `${t('filters.stockLevel')} : ${t(`levels.${filters.stockLevel === 'available' ? 'ok' : filters.stockLevel}`)}`
      : null
  ].filter((line): line is string => Boolean(line));
  const fileName = `${data.title} ${result.dated ? `${filters.from} – ${filters.to}` : issuedAt.slice(0, 10)}`;

  return (
    <main className="page-content report-page">
      <div className="no-print">
        <header className="report-heading">
          <div>
            <p className="report-kicker"><bdi dir="ltr">{reportNumber(slug)}</bdi> · {t(`groups.${report.group}`)}</p>
            <h1>{data.title}</h1>
            <span>{data.description}</span>
          </div>
          <Link href={`/${locale}/reports`} className="report-back"><Back size={16} aria-hidden="true" />{t('allReports')}</Link>
        </header>

        <ReportFilterForm
          filters={report.filters}
          values={{
            preset: filters.preset,
            from: filters.from,
            to: filters.to,
            employee: filters.employeeId ? String(filters.employeeId) : '',
            status: filters.saleStatus ?? '',
            category: filters.categoryId ? String(filters.categoryId) : '',
            type: filters.movementType ?? '',
            level: filters.stockLevel ?? ''
          }}
          presets={REPORT_PRESETS}
          employees={options.employees}
          categories={options.categories}
          movementTypes={options.movementTypes}
        />

        <div className="report-bar">
          <p className="report-period">
            {result.dated
              ? <>{t('periodLabel')} <bdi dir="ltr">{filters.from}</bdi> → <bdi dir="ltr">{filters.to}</bdi></>
              : t('snapshot')}
          </p>
          {canExport ? (
            <ReportActions
              fileName={fileName}
              labels={{print: t('print'), pdf: t('downloadPdf'), preparing: t('preparingPdf'), error: t('pdfError')}}
            />
          ) : null}
        </div>

        <ReportSummary result={result} rowCountLabel={t('rowCount', {count: result.rows.length})} duration={duration} />
        {result.truncated ? <p className="rpt-truncated">{t('truncated', {count: result.rows.length})}</p> : null}
        <ReportDataTable result={result} locale={locale} duration={duration} emptyText={t('empty')} />
      </div>

      {canExport ? (
        <ReportSheet
          report={report}
          title={data.title}
          result={result}
          duration={duration}
          period={{from: filters.from, to: filters.to}}
          applied={applied}
          issuedAt={issuedAt}
          locale={locale}
        />
      ) : null}
    </main>
  );
}
