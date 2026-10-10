import {eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {settings} from '@/db/schema';

export async function getPharmacyName() {
  const [row] = await db
    .select({pharmacyName: settings.pharmacyName})
    .from(settings)
    .where(eq(settings.key, 'default'));
  return row?.pharmacyName ?? 'Pharmacy';
}
