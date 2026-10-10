import {defineConfig} from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://pharmacy_test:pharmacy_test@127.0.0.1:55432/pharmacy_test'
  },
  strict: true,
  verbose: true
});
