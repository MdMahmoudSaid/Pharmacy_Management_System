import {describe, expect, it} from 'vitest';

import {money} from '@/lib/decimal';

describe('money', () => {
  it('adds decimal values without binary floating-point drift', () => {
    expect(money.add('0.10', '0.20')).toBe('0.30');
  });

  it('multiplies and returns a two-decimal database value', () => {
    expect(money.multiply('12.50', 3)).toBe('37.50');
  });

  it('formats a decimal string for display', () => {
    expect(money.format('1234.50', 'fr-MR')).toMatch(/1[\s\u202f]234,50/);
  });
});
