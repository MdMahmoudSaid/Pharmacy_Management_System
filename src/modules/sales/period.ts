import {nouakchottRange} from '@/lib/time';

export const SALE_PERIODS = ['today', 'this_week', 'this_month', 'all'] as const;

export type SalePeriod = (typeof SALE_PERIODS)[number];

export function parseSalePeriod(value: string | undefined): SalePeriod {
  return SALE_PERIODS.find((period) => period === value) ?? 'today';
}

export function salePeriodRange(period: SalePeriod, now = new Date()): {from?: Date; to?: Date} {
  return period === 'all' ? {} : nouakchottRange(period, now);
}
