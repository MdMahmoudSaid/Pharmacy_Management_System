import {getTranslations} from 'next-intl/server';

import type {PermissionActor} from '@/modules/permissions/service';
import {buildReport} from './builders';
import {findReport} from './catalog';
import {parseReportFilters} from './filters';
import type {DurationFormatter} from './format';

type SearchParams = Record<string, string | string[] | undefined>;

// Everything the screen, the print view and the CSV export need for one report, built the same way for all three.
export async function loadReport(actor: PermissionActor, slug: string, query: SearchParams, locale: 'ar' | 'fr') {
  const report = findReport(slug);
  if (!report) return null;
  const filters = parseReportFilters(query);
  const [result, t] = await Promise.all([
    buildReport(actor, slug, filters, locale),
    getTranslations({locale, namespace: 'Reports'})
  ]);
  const duration: DurationFormatter = (minutes) =>
    t('durationValue', {hours: Math.floor(minutes / 60), minutes: minutes % 60});
  return {
    report,
    filters,
    result,
    duration,
    title: t(`list.${report.slug}.title` as 'list.shifts.title'),
    description: t(`list.${report.slug}.description` as 'list.shifts.description')
  };
}
