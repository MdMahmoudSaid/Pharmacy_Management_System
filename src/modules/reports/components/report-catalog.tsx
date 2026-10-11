import {ArrowUpLeft, ArrowUpRight} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {REPORT_GROUPS, REPORTS, reportNumber} from '../catalog';

export async function ReportCatalog({locale, visible}: {locale: 'ar' | 'fr'; visible: readonly string[]}) {
  const t = await getTranslations('Reports');
  const Arrow = locale === 'ar' ? ArrowUpLeft : ArrowUpRight;
  return (
    <div className="report-catalog">
      {REPORT_GROUPS.map((group) => {
        const reports = REPORTS.filter((report) => report.group === group && visible.includes(report.slug));
        if (!reports.length) return null;
        return (
          <section key={group} aria-labelledby={`report-group-${group}`}>
            <h2 id={`report-group-${group}`}>{t(`groups.${group}`)}</h2>
            <div className="report-cards">
              {reports.map(({slug}) => (
                <Link key={slug} href={`/${locale}/reports/${slug}`} className="report-card">
                  <span className="report-card-number"><bdi dir="ltr">{reportNumber(slug)}</bdi></span>
                  <strong>{t(`list.${slug}.title` as 'list.shifts.title')}</strong>
                  <small>{t(`list.${slug}.description` as 'list.shifts.description')}</small>
                  <Arrow className="report-card-arrow" size={20} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
