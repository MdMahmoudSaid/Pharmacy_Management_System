import {asc, eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {medicines} from '@/db/schema';

export {searchMedicines} from './service';

export const listMedicines = () =>
  db.select().from(medicines).orderBy(asc(medicines.name));

export const getMedicine = async (id: number) => {
  const [medicine] = await db.select().from(medicines).where(eq(medicines.id, id)).limit(1);
  return medicine ?? null;
};
