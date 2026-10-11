import {getTranslations} from 'next-intl/server';

import {BrandMark} from '@/components/brand-mark';
import type {ReportResult} from '../builders';
import {reportNumber, type ReportDefinition} from '../catalog';
import type {DurationFormatter} from '../format';
import {ReportDataTable, ReportSummary} from './report-document';

// The paper version of a report: hidden on screen, printed by "Imprimer" and captured by "Télécharger le PDF".
export async function ReportSheet({report, title, result, duration, period, applied, issuedAt, locale}: {
  report: ReportDefinition;
  title: string;
  result: ReportResult;
  duration: DurationFormatter;
  period: {from: string; to: string};
  applied: string[];
  issuedAt: string;
  locale: 'ar' | 'fr';
}) {
  const [t, nav] = await Promise.all([getTranslations('Reports'), getTranslations('Navigation')]);
  const landscape = result.columns.length > 6;
  return (
    <div id="report-sheet" className={`rpt-sheet rpt-pdf-source${landscape ? ' is-landscape' : ''}`} aria-hidden="true">
      <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`}</style>
      <header className="rpt-band">
        <div className="rpt-band-brand">
          <BrandMark className="rpt-band-logo" />
          <div>
            <strong>{nav('brand')}</strong>
            <span>{t('printTagline')}</span>
          </div>
        </div>
        <div className="rpt-band-meta">
          <span>{t('issuedAt')}</span>
          <bdi dir="ltr">{issuedAt}</bdi>
        </div>
      </header>
      <section className="rpt-print-heading">
        <p><bdi dir="ltr">{reportNumber(report.slug)}</bdi> · {t(`groups.${report.group}`)}</p>
        <h2>{title}</h2>
        <ul>
          <li>
            {result.dated
              ? <>{t('periodLabel')} <bdi dir="ltr">{period.from}</bdi> → <bdi dir="ltr">{period.to}</bdi></>
              : <>{t('snapshotAt')} <bdi dir="ltr">{issuedAt}</bdi></>}
          </li>
          {applied.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
      <ReportSummary result={result} rowCountLabel={t('rowCount', {count: result.rows.length})} duration={duration} />
      {result.truncated ? <p className="rpt-truncated">{t('truncated', {count: result.rows.length})}</p> : null}
      <ReportDataTable result={result} locale={locale} duration={duration} emptyText={t('empty')} />
      <footer className="rpt-print-footer">
        <span>{nav('brand')}</span>
        <span>{t('generatedBy')}</span>
      </footer>
    </div>
  );
}
