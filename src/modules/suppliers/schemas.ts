import {z} from 'zod';

import {positiveMoneySchema} from '@/modules/auth/schemas';

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

export const supplierIdSchema = z.number().int().positive();
export const supplierInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  phone: nullableText(50),
  contactPerson: nullableText(200),
  address: nullableText(500),
  note: nullableText(2000)
});
export const supplierUpdateSchema = supplierInputSchema.extend({id: supplierIdSchema});
export const supplierPaymentSchema = z.object({
  supplierId: supplierIdSchema,
  amount: positiveMoneySchema,
  occurredAt: z.date().optional(),
  reference: nullableText(200),
  note: nullableText(2000)
});
