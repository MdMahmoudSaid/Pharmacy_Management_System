import {desc, eq} from 'drizzle-orm';
import {db} from '@/db/client';
import {saleItems, sales} from '@/db/schema';

export const listSales = () => db.select().from(sales).orderBy(desc(sales.createdAt));
export const getSaleItems = (saleId: number) =>
  db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
