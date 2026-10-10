import {loadEnvFile} from 'node:process';

if (!process.env.DATABASE_URL) {
  loadEnvFile('.env.test');
}
