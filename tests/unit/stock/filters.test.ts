import {describe, expect, it} from 'vitest';

import {stockStatus} from '@/modules/medicines/components/medicine-list';
import {movementQuery, parseMovementFilters} from '@/modules/stock/filters';

describe('stock status', () => {
  it('flags archived, out, low and available medicines', () => {
    expect(stockStatus({isActive: false, currentStock: 50, minStock: 5})).toBe('archived');
    expect(stockStatus({isActive: true, currentStock: 0, minStock: 5})).toBe('out');
    expect(stockStatus({isActive: true, currentStock: 5, minStock: 5})).toBe('low');
    expect(stockStatus({isActive: true, currentStock: 6, minStock: 5})).toBe('available');
  });
});

describe('movement filters', () => {
  it('falls back to all for unknown values', () => {
    expect(parseMovementFilters({type: 'nope', period: 'forever'})).toEqual({type: 'all', period: 'all'});
  });

  it('maps type groups and periods to query filters', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(movementQuery({type: 'all', period: 'all'}, now)).toEqual({types: undefined});
    expect(movementQuery({type: 'received', period: 'today'}, now)).toEqual({
      types: ['STOCK_RECEIVED'],
      from: new Date('2026-10-10T00:00:00Z'),
      to: new Date('2026-10-11T00:00:00Z')
    });
    expect(movementQuery({type: 'corrections', period: 'all'}, now).types).toContain('SALE_CANCELLATION');
  });
});
