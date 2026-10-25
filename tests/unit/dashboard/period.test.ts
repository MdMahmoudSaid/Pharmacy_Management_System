import {describe, expect, it} from 'vitest';

import {parseDashboardPeriod} from '@/modules/dashboard/period';

const now = new Date('2026-10-10T12:00:00Z');

describe('dashboard period', () => {
  it('defaults to this month', () => {
    expect(parseDashboardPeriod({}, now)).toEqual({
      preset: 'this_month',
      range: {from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-01T00:00:00Z')}
    });
    expect(parseDashboardPeriod({period: 'today'}, now).range).toEqual({
      from: new Date('2026-10-10T00:00:00Z'),
      to: new Date('2026-10-11T00:00:00Z')
    });
  });

  it('supports week and month presets and ignores unknown values', () => {
    expect(parseDashboardPeriod({period: 'this_week'}, now).range.from).toEqual(new Date('2026-10-05T00:00:00Z'));
    expect(parseDashboardPeriod({period: 'this_month'}, now).range).toEqual({
      from: new Date('2026-10-01T00:00:00Z'),
      to: new Date('2026-11-01T00:00:00Z')
    });
    expect(parseDashboardPeriod({period: 'forever'}, now).preset).toBe('this_month');
  });

  it('treats a custom end date as inclusive and orders reversed dates', () => {
    expect(parseDashboardPeriod({from: '2026-10-10', to: '2026-10-01'}, now)).toEqual({
      preset: 'custom',
      from: '2026-10-01',
      to: '2026-10-10',
      range: {from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-10-11T00:00:00Z')}
    });
  });

  it('falls back to the preset when a custom date is invalid', () => {
    expect(parseDashboardPeriod({period: 'this_month', from: '2026-13-45', to: '2026-10-01'}, now).preset).toBe('this_month');
  });
});
