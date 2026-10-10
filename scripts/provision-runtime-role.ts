import pg from 'pg';
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const password = process.env.APP_DATABASE_PASSWORD;
if (!migrationUrl || !password) throw new Error('MIGRATION_DATABASE_URL and APP_DATABASE_PASSWORD are required');
const pool = new pg.Pool({connectionString: migrationUrl});
const {rows} = await pool.query<{command: string}>("select format('alter role pharmacy_app login password %L', $1::text) as command", [password]);
await pool.query(rows[0].command);
await pool.end();
