import Decimal from 'decimal.js';
import {z} from 'zod';

export const localPhoneSchema = z
  .string()
  .regex(/^[234]\d{7}$/, 'INVALID_MAURITANIAN_PHONE');

export function normalizeMauritanianPhone(local: string): string {
  return `+222${localPhoneSchema.parse(local)}`;
}

export const pinSchema = z.string().regex(/^\d{4}$/, 'INVALID_PIN');

export const positiveMoneySchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, 'INVALID_MONEY')
  .refine((value) => new Decimal(value).greaterThan(0), 'MONEY_MUST_BE_POSITIVE');

export const positiveQuantitySchema = z.number().int().positive();

// Only cancellations and shift reopenings must be justified; other corrections may carry a note.
export const sensitiveReasonSchema = z.string().trim().min(1, 'REASON_REQUIRED');
export const optionalReasonSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
