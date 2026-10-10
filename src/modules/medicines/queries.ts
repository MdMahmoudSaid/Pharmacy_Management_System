import {asc} from 'drizzle-orm';

import {db} from '@/db/client';
import {medicines} from '@/db/schema';

export {searchMedicines} from './service';

export const listMedicines = () =>
  db.select().from(medicines).orderBy(asc(medicines.name));
