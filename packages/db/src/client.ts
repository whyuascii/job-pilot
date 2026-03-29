import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '@job-pilot/shared';
import * as schema from './schema/index.js';

const env = getEnv();
const connectionString = env.DATABASE_URL;

const client = postgres(connectionString, {
  max: parseInt(process.env.DB_POOL_MAX ?? '10'),
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT ?? '20'),
  connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT ?? '10'),
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
