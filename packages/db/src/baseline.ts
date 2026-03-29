/**
 * Baseline script — marks the initial migration (0000_serious_proudstar) as
 * already applied in __drizzle_migrations without re-running the SQL.
 *
 * Run once against a database that was previously set up via `db:push`.
 * After this, `db:migrate:run` can apply future incremental migrations.
 *
 * Usage: pnpm --filter @job-pilot/db db:baseline
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env in local dev
try {
  const { config } = await import('dotenv');
  config({ path: resolve(__dirname, '../../../.env') });
} catch {
  // production — env vars set by ECS
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const { default: postgres } = await import('postgres');
const sql = postgres(connectionString, { max: 1 });

// Read migration SQL and compute its SHA-256 hash (same algo as drizzle-orm migrator)
const migrationPath = resolve(__dirname, 'migrations/0000_serious_proudstar.sql');
const migrationSql = readFileSync(migrationPath, 'utf-8');
const hash = createHash('sha256').update(migrationSql).digest('hex');

// Create the tracking table (same schema drizzle-orm uses)
await sql`
  CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`;

// Check if already baselined
const existing = await sql`SELECT id FROM "__drizzle_migrations" WHERE hash = ${hash} LIMIT 1`;

if (existing.length > 0) {
  console.log('Already baselined — migration 0000_serious_proudstar is recorded.');
  await sql.end();
  process.exit(0);
}

await sql`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${Date.now()})`;

console.log('Baseline applied — migration 0000_serious_proudstar marked as applied.');
console.log('Future migrations will be applied with: pnpm --filter @job-pilot/db db:migrate:run');

await sql.end();
process.exit(0);
