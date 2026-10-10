import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';

import * as schema from './schema';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

export const db = drizzle({client: pool, schema});

export type Database = typeof db;
export type DbTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];
