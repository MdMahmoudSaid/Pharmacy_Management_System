import {describe, expect, it} from 'vitest';

import {
  normalizeMauritanianPhone,
  pinSchema,
  positiveMoneySchema,
  positiveQuantitySchema,
  sensitiveReasonSchema
} from '@/modules/auth/schemas';

describe('shared validation', () => {
  it.each(['21234567', '31234567', '41234567'])(
    'normalizes valid local phone %s',
    (local) => expect(normalizeMauritanianPhone(local)).toBe(`+222${local}`)
  );

  it.each(['11234567', '51234567', '2123456', '212345678', '2A234567'])(
    'rejects invalid local phone %s',
    (local) => expect(() => normalizeMauritanianPhone(local)).toThrow()
  );

  it.each(['0000', '1234', '9999'])('accepts four-digit PIN %s', (pin) => {
    expect(pinSchema.parse(pin)).toBe(pin);
  });

  it.each(['123', '12345', '12a4'])('rejects invalid PIN %s', (pin) => {
    expect(() => pinSchema.parse(pin)).toThrow();
  });

  it.each(['0', '-1', '1.001'])('rejects invalid money %s', (amount) => {
    expect(() => positiveMoneySchema.parse(amount)).toThrow();
  });

  it('accepts positive money with at most two decimal places', () => {
    expect(positiveMoneySchema.parse('12.50')).toBe('12.50');
  });

  it.each([0, -1, 1.5])('rejects invalid quantity %s', (quantity) => {
    expect(() => positiveQuantitySchema.parse(quantity)).toThrow();
  });

  it('trims a required sensitive reason', () => {
    expect(sensitiveReasonSchema.parse('  erreur de saisie  ')).toBe(
      'erreur de saisie'
    );
    expect(() => sensitiveReasonSchema.parse('   ')).toThrow();
  });
});
