import {z} from 'zod';

import {optionalReasonSchema, positiveMoneySchema} from '@/modules/auth/schemas';

export const medicineIdSchema = z.number().int().positive();
export const medicineInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(80).nullable().optional(),
  sellingPrice: positiveMoneySchema,
  minStock: z.number().int().min(0).max(1_000_000).optional()
});
export const updateMedicineSchema = medicineInputSchema.extend({
  id: medicineIdSchema,
  reason: optionalReasonSchema
});
export const medicineReasonSchema = optionalReasonSchema;
