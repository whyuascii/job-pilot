import { z } from 'zod';

const serverEnvSchema = z.object({
  // Database (required)
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // Redis (optional — caching degrades gracefully without it)
  REDIS_URL: z.string().optional(),

  // AI Services (optional - warn if missing)
  ANTHROPIC_API_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),

  // Firecrawl (optional)
  FIRECRAWL_API_KEY: z.string().optional(),

  // S3/MinIO Storage (required for file operations)
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_BUCKET: z.string().default('job-pilot'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_REGION: z.string().default('us-east-1'),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Auth
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .default('change-me-in-production-at-least-32-chars!!'),

  // Encryption (optional - falls back to BETTER_AUTH_SECRET or SESSION_SECRET)
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _env: ServerEnv | null = null;

export function validateEnv(): ServerEnv {
  if (_env) return _env;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n');

    throw new Error(
      `Environment validation failed:\n${errorMessages}\n\nCheck your .env file and ensure all required variables are set.`,
    );
  }

  _env = result.data;

  // Block unsafe defaults in production
  if (_env.NODE_ENV === 'production') {
    if (_env.S3_ACCESS_KEY === 'minioadmin' || _env.S3_SECRET_KEY === 'minioadmin') {
      throw new Error(
        'S3_ACCESS_KEY / S3_SECRET_KEY must not use default minioadmin credentials in production',
      );
    }
    if (_env.SESSION_SECRET === 'change-me-in-production-at-least-32-chars!!') {
      throw new Error('SESSION_SECRET must be changed from its default value in production');
    }
  }

  // Warn about optional but recommended variables
  if (!_env.REDIS_URL) {
    console.warn('[env] REDIS_URL is not set - caching disabled, using DB for sessions');
  }
  if (!_env.ANTHROPIC_API_KEY) {
    console.warn('[env] ANTHROPIC_API_KEY is not set - AI features will be disabled');
  }
  if (!_env.FIRECRAWL_API_KEY) {
    console.warn('[env] FIRECRAWL_API_KEY is not set - web scraping features will be disabled');
  }

  return _env;
}

export function getEnv(): ServerEnv {
  if (!_env) {
    return validateEnv();
  }
  return _env;
}
