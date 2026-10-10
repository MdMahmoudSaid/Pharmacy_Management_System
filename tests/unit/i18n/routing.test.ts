import {describe, expect, it} from 'vitest';

import {directionFor, routing} from '@/i18n/routing';

describe('locale routing', () => {
  it('defaults to Arabic and maps writing directions', () => {
    expect(routing.locales).toEqual(['ar', 'fr']);
    expect(routing.defaultLocale).toBe('ar');
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('fr')).toBe('ltr');
  });
});
