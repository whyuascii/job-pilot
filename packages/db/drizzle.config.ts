import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

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
