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

  // Firecrawl (deprecated — using native web scraper now)
  FIRECRAWL_API_KEY: z.string().optional(),

  // S3/MinIO Storage
  // In production (ECS): omit S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY — uses IAM task role
  // In local dev: set S3_ENDPOINT=http://localhost:9000 + MinIO keys
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().default('job-pilot'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Auth — BETTER_AUTH_SECRET is the primary secret; SESSION_SECRET is an alias
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  SESSION_SECRET: z.string().min(32).optional(),

  // Encryption (optional - falls back to BETTER_AUTH_SECRET or SESSION_SECRET)
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').optional(),

  // PostHog analytics (optional)
  POSTHOG_API_KEY: z.string().optional(),
  VITE_POSTHOG_KEY: z.string().optional(),
  VITE_POSTHOG_HOST: z.string().url().optional(),
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

  // Block missing auth secret in production
  if (_env.NODE_ENV === 'production') {
    const authSecret = _env.BETTER_AUTH_SECRET || _env.SESSION_SECRET;
    if (!authSecret) {
      throw new Error(
        'BETTER_AUTH_SECRET or SESSION_SECRET must be set in production (min 32 chars)',
      );
    }
  }

  // Warn about optional but recommended variables
  if (!_env.REDIS_URL) {
    console.warn('[env] REDIS_URL is not set - caching disabled, using DB for sessions');
  }
  if (!_env.ANTHROPIC_API_KEY) {
    console.warn('[env] ANTHROPIC_API_KEY is not set - AI features will be disabled');
  }

  return _env;
}

export function getEnv(): ServerEnv {
  if (!_env) {
    return validateEnv();
  }
  return _env;
}
