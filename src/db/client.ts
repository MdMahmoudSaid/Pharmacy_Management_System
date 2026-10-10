import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';

import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

export const db = drizzle({client: pool, schema});

export type Database = typeof db;
export type DbTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];
