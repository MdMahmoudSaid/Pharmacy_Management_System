import {z} from 'zod';

import {positiveMoneySchema, sensitiveReasonSchema} from '@/modules/auth/schemas';

export const medicineIdSchema = z.number().int().positive();
export const medicineInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(80).nullable().optional(),
  sellingPrice: positiveMoneySchema
});
export const updateMedicineSchema = medicineInputSchema.extend({
  id: medicineIdSchema,
  reason: z.string().optional()
});
export const medicineReasonSchema = sensitiveReasonSchema;
