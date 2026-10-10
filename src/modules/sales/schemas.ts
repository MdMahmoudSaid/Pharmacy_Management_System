import {z} from 'zod';

import {
  positiveMoneySchema,
  positiveQuantitySchema,
  sensitiveReasonSchema
} from '@/modules/auth/schemas';

export const saleItemSchema = z.object({
  medicineId: z.number().int().positive(),
  quantity: positiveQuantitySchema,
  unitPrice: positiveMoneySchema.optional(),
  overrideReason: z.string().optional()
});

export const createSaleSchema = z
  .object({
    shiftId: z.number().int().positive(),
    idempotencyKey: z.string().trim().min(8).max(200),
    items: z.array(saleItemSchema).min(1)
  })
  .refine(
    ({items}) => new Set(items.map(({medicineId}) => medicineId)).size === items.length,
    {message: 'DUPLICATE_MEDICINE'}
  );

export const priceOverrideReasonSchema = sensitiveReasonSchema;
