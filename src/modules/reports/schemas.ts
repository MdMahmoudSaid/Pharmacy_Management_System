import {z} from 'zod';

export const reportPresetSchema = z.enum([
  'today',
  'yesterday',
  'this_week',
  'this_month',
  'last_month',
  'this_year'
]);

export const REPORT_PRESETS = reportPresetSchema.options;
