import {
  parseDashboardPeriod,
  type DashboardPeriod
} from '@/modules/dashboard/period';

export type AccountsPeriod = DashboardPeriod;
type DashboardPeriodQuery = Parameters<typeof parseDashboardPeriod>[0];

export function parseAccountsPeriod(query: DashboardPeriodQuery, now = new Date()) {
  return parseDashboardPeriod(
    {...query, period: query.period ?? 'this_month'},
    now
  );
}
