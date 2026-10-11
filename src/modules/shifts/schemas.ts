import {z} from 'zod';

import {optionalReasonSchema, sensitiveReasonSchema} from '@/modules/auth/schemas';

export const shiftIdSchema = z.number().int().positive();

export const correctShiftSchema = z
  .object({
    shiftId: shiftIdSchema,
    openedAt: z.date(),
    closedAt: z.date().nullable(),
    reason: optionalReasonSchema
  })
  .refine(
    ({openedAt, closedAt}) => !closedAt || closedAt.getTime() >= openedAt.getTime(),
    {message: 'CLOSE_BEFORE_OPEN', path: ['closedAt']}
  );

export const reopenShiftSchema = z.object({
  shiftId: shiftIdSchema,
  reason: sensitiveReasonSchema
});
