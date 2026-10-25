import {z} from 'zod';

import {positiveMoneySchema} from '@/modules/auth/schemas';

export const capitalMovementInputSchema = z.object({
  type: z.enum(['ADDITION', 'WITHDRAWAL']),
  amount: positiveMoneySchema,
  source: z.enum(['PROFIT', 'CAPITAL']).optional(),
  allowCapitalFallback: z.boolean().optional().default(false),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
  occurredAt: z.date().optional()
});
