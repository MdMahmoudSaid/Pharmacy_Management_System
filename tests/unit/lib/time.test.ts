import {describe, expect, it} from 'vitest';

import {nouakchottRange} from '@/lib/time';

describe('Nouakchott report ranges', () => {
  const now = new Date('2026-10-10T12:34:56.000Z');

  it.each([
    ['today', '2026-10-10T00:00:00.000Z', '2026-10-11T00:00:00.000Z'],
    ['yesterday', '2026-10-09T00:00:00.000Z', '2026-10-10T00:00:00.000Z'],
    ['this_week', '2026-10-05T00:00:00.000Z', '2026-10-12T00:00:00.000Z'],
    ['this_month', '2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']
  ] as const)('returns a half-open %s range', (preset, from, to) => {
    const range = nouakchottRange(preset, now);

    expect(range.from.toISOString()).toBe(from);
    expect(range.to.toISOString()).toBe(to);
  });
});
