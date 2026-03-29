import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Use a dedicated connection for migrations (max 1, no pooling)
const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function main() {
  // Resolve migrations folder relative to this file (works regardless of CWD)
  const migrationsFolder = resolve(__dirname, 'migrations');
  console.log(`Running migrations from ${migrationsFolder}...`);
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed successfully');
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
