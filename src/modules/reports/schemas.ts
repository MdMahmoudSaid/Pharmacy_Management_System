import {z} from 'zod';

export const reportPresetSchema = z.enum([
  'today',
  'yesterday',
  'this_week',
  'this_month'
]);
