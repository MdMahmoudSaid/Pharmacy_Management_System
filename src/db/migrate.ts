import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';

import {migrate} from 'drizzle-orm/node-postgres/migrator';

export async function migrateDatabase() {
  if (!process.env.DATABASE_URL) {
    loadEnvFile('.env.test');
  }

  const {db} = await import('./client');
  await migrate(db, {migrationsFolder: 'drizzle'});
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  await migrateDatabase();
  const {pool} = await import('./client');
  await pool.end();
}
