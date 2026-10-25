import {describe, expect, it} from 'vitest';

import {parseAccountsPeriod} from '@/modules/accounts/period';

const now = new Date('2026-10-25T12:00:00Z');

describe('accounts period', () => {
  it('defaults to the current month', () => {
    expect(parseAccountsPeriod({}, now)).toEqual({
      preset: 'this_month',
      range: {
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-11-01T00:00:00Z')
      }
    });
  });

  it('supports day, week, and an inclusive custom range', () => {
    expect(parseAccountsPeriod({period: 'today'}, now).range).toEqual({
      from: new Date('2026-10-25T00:00:00Z'),
      to: new Date('2026-10-26T00:00:00Z')
    });
    expect(parseAccountsPeriod({period: 'this_week'}, now).range.from).toEqual(
      new Date('2026-10-19T00:00:00Z')
    );
    expect(parseAccountsPeriod({from: '2026-10-10', to: '2026-10-12'}, now)).toEqual({
      preset: 'custom',
      from: '2026-10-10',
      to: '2026-10-12',
      range: {
        from: new Date('2026-10-10T00:00:00Z'),
        to: new Date('2026-10-13T00:00:00Z')
      }
    });
  });
});
