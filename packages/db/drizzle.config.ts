import { defineConfig } from 'drizzle-kit';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { config } from 'dotenv';

// Load .env from monorepo root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: './src/schema/*',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
