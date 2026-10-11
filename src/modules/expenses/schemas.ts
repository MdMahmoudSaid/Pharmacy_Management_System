import {z} from 'zod';

import {optionalReasonSchema, positiveMoneySchema, sensitiveReasonSchema} from '@/modules/auth/schemas';

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((value) => value || null);

const expenseFields = z.object({
  amount: positiveMoneySchema,
  categoryId: z.number().int().positive().optional(),
  description: optionalText
});

const namesExpense = (value: {categoryId?: number; description: string | null}) =>
  value.categoryId !== undefined || value.description !== null;

export const expenseIdSchema = z.number().int().positive();
export const expenseInputSchema = expenseFields
  .extend({shiftId: z.number().int().positive()})
  .refine(namesExpense, 'CATEGORY_REQUIRED');
export const expenseCorrectionSchema = expenseFields
  .extend({reason: optionalReasonSchema})
  .refine(namesExpense, 'CATEGORY_REQUIRED');
export const expenseReasonSchema = sensitiveReasonSchema;
