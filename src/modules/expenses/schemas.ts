import {z} from 'zod';

import {positiveMoneySchema, sensitiveReasonSchema} from '@/modules/auth/schemas';

export const expenseIdSchema = z.number().int().positive();
export const expenseInputSchema = z.object({
  shiftId: z.number().int().positive(),
  amount: positiveMoneySchema,
  description: z.string().trim().min(1)
});
export const expenseCorrectionSchema = z.object({
  amount: positiveMoneySchema,
  description: z.string().trim().min(1),
  reason: sensitiveReasonSchema
});
export const expenseReasonSchema = sensitiveReasonSchema;
