import {z} from 'zod';

export const settingsSchema = z.object({
  pharmacyName: z.string().trim().min(1).max(160),
  defaultLocale: z.enum(['ar', 'fr'])
});
