import {z} from 'zod';

import {
  optionalReasonSchema,
  positiveMoneySchema,
  positiveQuantitySchema
} from '@/modules/auth/schemas';

export const receiveStockSchema = z
  .object({
    medicineId: z.number().int().positive(),
    supplierId: z.number().int().positive(),
    quantity: positiveQuantitySchema,
    unitCost: positiveMoneySchema,
    sellingPrice: positiveMoneySchema,
    note: z.string().trim().max(500).optional()
  });

export const receiveStockBatchSchema = z.object({
  supplierId: z.number().int().positive(),
  note: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        medicineId: z.number().int().positive(),
        quantity: positiveQuantitySchema,
        totalCost: positiveMoneySchema,
        sellingPrice: positiveMoneySchema
      })
    )
    .min(1)
    .max(40)
    .refine((lines) => new Set(lines.map(({medicineId}) => medicineId)).size === lines.length, 'DUPLICATE_MEDICINE')
});

export const correctStockReceiptSchema = z.object({
  receiptId: z.number().int().positive(),
  medicineId: z.number().int().positive(),
  quantity: positiveQuantitySchema,
  reason: optionalReasonSchema
});

export const adjustStockSchema = z.object({
  medicineId: z.number().int().positive(),
  quantityChange: z.number().int().refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(500)
});
