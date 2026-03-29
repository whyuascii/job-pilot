import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load .env from monorepo root BEFORE any app code evaluates
// In production (ECS), dotenv may not be available — env vars come from the task definition
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const { config } = await import('dotenv');
  config({ path: resolve(__dirname, '../../../.env') });
} catch {
  // dotenv not available in production — env vars set by ECS task definition
}

await import('./index.js');
