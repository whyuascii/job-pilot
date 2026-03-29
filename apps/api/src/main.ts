import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env from monorepo root BEFORE any app code evaluates
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

await import('./index.js');
