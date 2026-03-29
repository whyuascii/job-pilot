import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env in local dev; in production (ECS) env vars come from the task definition
try {
  const { config } = await import('dotenv');
  config({ path: resolve(__dirname, '../../../.env') });
} catch {
  // dotenv not available (production) — env vars already set by ECS
}

await import('./migrate.js');
