import {z} from 'zod';

import {PERMISSION_KEYS} from '@/modules/permissions/catalog';
import {
  localPhoneSchema,
  optionalReasonSchema,
  pinSchema
} from '@/modules/auth/schemas';

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: localPhoneSchema,
  pin: pinSchema
});

export const updateEmployeeSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  phone: localPhoneSchema
});

export const employeeReasonSchema = optionalReasonSchema;
export const employeePermissionsSchema = z.array(z.enum(PERMISSION_KEYS));
