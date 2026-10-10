import {nouakchottRange} from '@/lib/time';
import type {MovementType} from './service';

export const MOVEMENT_TYPE_FILTERS = ['all', 'received', 'sales', 'corrections'] as const;
export const MOVEMENT_PERIODS = ['all', 'today', 'this_week', 'this_month'] as const;

export type MovementFilters = {
  type: (typeof MOVEMENT_TYPE_FILTERS)[number];
  period: (typeof MOVEMENT_PERIODS)[number];
};

const TYPES: Record<MovementFilters['type'], MovementType[] | undefined> = {
  all: undefined,
  received: ['STOCK_RECEIVED'],
  sales: ['SALE'],
  corrections: ['SALE_CANCELLATION', 'SALE_CORRECTION', 'STOCK_RECEIPT_CORRECTION', 'MANUAL_CORRECTION', 'OTHER_ADJUSTMENT']
};

export function parseMovementFilters(query: {type?: string; period?: string}): MovementFilters {
  return {
    type: MOVEMENT_TYPE_FILTERS.find((value) => value === query.type) ?? 'all',
    period: MOVEMENT_PERIODS.find((value) => value === query.period) ?? 'all'
  };
}

export function movementQuery(filters: MovementFilters, now = new Date()) {
  const range = filters.period === 'all' ? {} : nouakchottRange(filters.period, now);
  return {types: TYPES[filters.type], ...range};
}
