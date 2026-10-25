import {getTranslations} from 'next-intl/server';

import {BrandMark} from '@/components/brand-mark';
import {getSettings} from '@/modules/settings/queries';
import {companyLines} from '@/modules/settings/company';
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
  const [t, settingsT, company] = await Promise.all([getTranslations('Reports'), getTranslations('Settings'), getSettings()]);
  const lines = companyLines(company.profile);
  const landscape = result.columns.length > 6;
  return (
    <div id="report-sheet" className={`rpt-sheet rpt-pdf-source${landscape ? ' is-landscape' : ''}`} aria-hidden="true">
      <style>{`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`}</style>
      <header className="rpt-head">
        <BrandMark className="rpt-head-logo" />
        <div className="rpt-head-name">
          <strong>{company.pharmacyName}</strong>
          <span>{lines.address || t('printTagline')}</span>
        </div>
        <div className="rpt-head-meta">
          <span>{reportNumber(report.slug)}</span>
          <bdi dir="ltr">{t('issuedAt')} · {issuedAt}</bdi>
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
      <footer className="rpt-foot" data-page-label={locale === 'fr' ? t('page') : ''}>
        <div className="rpt-foot-body">
          <div className="rpt-foot-block">
            <strong>{company.pharmacyName}</strong>
            {lines.address ? <span>{lines.address}</span> : null}
            {lines.phones.length || lines.email ? (
              <span>
                {lines.phones.map((phone, index) => <bdi key={phone} dir="ltr">{index ? ' · ' : ''}{phone}</bdi>)}
                {lines.phones.length && lines.email ? ' · ' : ''}
                {lines.email ? <bdi dir="ltr">{lines.email}</bdi> : null}
              </span>
            ) : null}
            {lines.identifiers.length ? (
              <span>{lines.identifiers.map(({key, value}, index) => <bdi key={key} dir="ltr">{index ? ' · ' : ''}{settingsT(key)} : {value}</bdi>)}</span>
            ) : null}
          </div>
          <span className="rpt-foot-page" />
        </div>
        <div className="rpt-foot-bar" aria-hidden="true"><i /><i /><i /></div>
      </footer>
    </div>
  );
}
