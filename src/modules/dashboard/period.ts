import {nouakchottRange} from '@/lib/time';

export const DASHBOARD_PRESETS = ['today', 'this_week', 'this_month'] as const;

export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number];

export type DashboardPeriod =
  | {preset: DashboardPreset; range: {from: Date; to: Date}}
  | {preset: 'custom'; from: string; to: string; range: {from: Date; to: Date}};

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = /^\d{4}-\d{2}-\d{2}$/;

const parseDay = (value: string | undefined) => {
  if (!value || !isoDay.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export function parseDashboardPeriod(
  query: {period?: string; from?: string; to?: string},
  now = new Date()
): DashboardPeriod {
  const from = parseDay(query.from);
  const to = parseDay(query.to);
  if (from && to) {
    const [start, end] = from <= to ? [from, to] : [to, from];
    return {
      preset: 'custom',
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      range: {from: start, to: new Date(end.getTime() + DAY_MS)}
    };
  }
  const preset = DASHBOARD_PRESETS.find((value) => value === query.period) ?? 'today';
  return {preset, range: nouakchottRange(preset, now)};
}
