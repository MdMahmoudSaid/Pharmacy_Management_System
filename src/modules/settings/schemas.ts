import {z} from 'zod';

const line = (max: number) => z.string().trim().max(max).default('');

export const companyProfileSchema = z.object({
  address: line(200),
  email: line(120),
  taxId: line(60),
  registration: line(60),
  phones: z
    .array(z.object({code: z.string().trim().regex(/^\d{1,4}$/).default('222'), number: z.string().trim().max(24)}))
    .max(3)
    .transform((rows) => rows.filter((row) => row.number))
});

export const settingsSchema = z.object({
  pharmacyName: z.string().trim().min(1).max(160),
  defaultLocale: z.enum(['ar', 'fr']),
  profile: companyProfileSchema.optional()
});

export type SettingsInput = z.input<typeof settingsSchema>;
