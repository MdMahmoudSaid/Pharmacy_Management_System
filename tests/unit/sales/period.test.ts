import {describe, expect, it} from 'vitest';

import {parseSalePeriod, salePeriodRange} from '@/modules/sales/period';

describe('sale history period', () => {
  it('defaults to today and accepts known presets', () => {
    expect(parseSalePeriod(undefined)).toBe('today');
    expect(parseSalePeriod('this_month')).toBe('this_month');
    expect(parseSalePeriod('forever')).toBe('today');
  });

  it('has no bounds for all and a calendar day for today', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(salePeriodRange('all', now)).toEqual({});
    expect(salePeriodRange('today', now)).toEqual({
      from: new Date('2026-10-10T00:00:00Z'),
      to: new Date('2026-10-11T00:00:00Z')
    });
  });
});
