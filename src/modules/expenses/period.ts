export const EXPENSE_PRESETS = ['all', 'today', 'this_month', 'this_year'] as const;

export type ExpensePreset = (typeof EXPENSE_PRESETS)[number] | 'custom';

export type ExpensePeriod = {
  preset: ExpensePreset;
  from?: string;
  to?: string;
  range: {from?: Date; to?: Date};
};

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = /^\d{4}-\d{2}-\d{2}$/;

const parseDay = (value: string | undefined) => {
  if (!value || !isoDay.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** Nouakchott is on UTC year-round, so UTC calendar boundaries are local ones. */
export function parseExpensePeriod(
  query: {period?: string; from?: string; to?: string},
  now = new Date()
): ExpensePeriod {
  if (query.period === 'custom') {
    const from = parseDay(query.from);
    const to = parseDay(query.to);
    if (!from || !to) return {preset: 'custom', from: query.from, to: query.to, range: {}};
    const [start, end] = from <= to ? [from, to] : [to, from];
    return {
      preset: 'custom',
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      range: {from: start, to: new Date(end.getTime() + DAY_MS)}
    };
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  if (query.period === 'today') {
    return {preset: 'today', range: {from: new Date(Date.UTC(year, month, day)), to: new Date(Date.UTC(year, month, day + 1))}};
  }
  if (query.period === 'this_month') {
    return {preset: 'this_month', range: {from: new Date(Date.UTC(year, month, 1)), to: new Date(Date.UTC(year, month + 1, 1))}};
  }
  if (query.period === 'this_year') {
    return {preset: 'this_year', range: {from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year + 1, 0, 1))}};
  }
  return {preset: 'all', range: {}};
}
