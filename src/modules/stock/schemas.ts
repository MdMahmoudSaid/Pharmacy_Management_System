import {z} from 'zod';

import {optionalReasonSchema, positiveQuantitySchema} from '@/modules/auth/schemas';

export const receiveStockSchema = z.object({
  medicineId: z.number().int().positive(),
  quantity: positiveQuantitySchema,
  note: z.string().trim().max(500).optional()
});

export const correctStockReceiptSchema = z.object({
  receiptId: z.number().int().positive(),
  medicineId: z.number().int().positive(),
  quantity: positiveQuantitySchema,
  reason: optionalReasonSchema
});
