import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Create a fresh copy of process.env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function importValidateEnv() {
    const mod = await import('./env');
    return mod.validateEnv;
  }

  it('validates successfully with all required env vars', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';
    // Optional vars will use defaults

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.DATABASE_URL).toBe('https://db.example.com/mydb');
    expect(env.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('throws when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';

    const validateEnv = await importValidateEnv();
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('allows optional REDIS_URL to be omitted', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    delete process.env.REDIS_URL;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.REDIS_URL).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('REDIS_URL is not set'));
    warnSpy.mockRestore();
  });

  it('throws when DATABASE_URL is not a valid URL', async () => {
    process.env.DATABASE_URL = 'not-a-url';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const validateEnv = await importValidateEnv();
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('provides defaults for optional S3 variables', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.S3_ENDPOINT).toBe('http://localhost:9000');
    expect(env.S3_BUCKET).toBe('job-pilot');
    expect(env.S3_ACCESS_KEY).toBe('minioadmin');
    expect(env.S3_SECRET_KEY).toBe('minioadmin');
    expect(env.S3_REGION).toBe('us-east-1');
  });

  it('provides default for AWS_REGION', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.AWS_REGION).toBe('us-east-1');
  });

  it('provides default for APP_URL', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.APP_URL).toBe('http://localhost:3000');
  });

  it('provides default for NODE_ENV', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';
    delete process.env.NODE_ENV;

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.NODE_ENV).toBe('development');
  });

  it('provides default for SESSION_SECRET', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.SESSION_SECRET).toBe('change-me-in-production-at-least-32-chars!!');
  });

  it('allows optional ANTHROPIC_API_KEY to be omitted', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';
    delete process.env.ANTHROPIC_API_KEY;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_API_KEY is not set'));
    warnSpy.mockRestore();
  });

  it('allows optional FIRECRAWL_API_KEY to be omitted', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';
    delete process.env.FIRECRAWL_API_KEY;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.FIRECRAWL_API_KEY).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('FIRECRAWL_API_KEY is not set'));
    warnSpy.mockRestore();
  });

  it('uses provided values when optional vars are set', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.AWS_REGION = 'eu-west-1';
    process.env.APP_URL = 'https://app.example.com';

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-test-key');
    expect(env.AWS_REGION).toBe('eu-west-1');
    expect(env.APP_URL).toBe('https://app.example.com');
  });

  it('caches the result on subsequent calls', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('./env');
    const first = mod.validateEnv();
    const second = mod.validateEnv();

    expect(first).toBe(second); // Same object reference (cached)
    warnSpy.mockRestore();
  });

  it('getEnv calls validateEnv if not yet validated', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('./env');
    const env = mod.getEnv();

    expect(env.DATABASE_URL).toBe('https://db.example.com/mydb');
    warnSpy.mockRestore();
  });

  it('throws when SESSION_SECRET is too short', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SESSION_SECRET = 'too-short';

    const validateEnv = await importValidateEnv();
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('throws in production when S3 defaults are minioadmin', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = 'a-real-production-secret-that-is-long-enough!!';
    // S3_ACCESS_KEY and S3_SECRET_KEY will default to 'minioadmin'

    const validateEnv = await importValidateEnv();
    expect(() => validateEnv()).toThrow('minioadmin');
  });

  it('throws in production when SESSION_SECRET is the default', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.NODE_ENV = 'production';
    process.env.S3_ACCESS_KEY = 'real-access-key';
    process.env.S3_SECRET_KEY = 'real-secret-key';
    // SESSION_SECRET will default to the placeholder

    const validateEnv = await importValidateEnv();
    expect(() => validateEnv()).toThrow('SESSION_SECRET must be changed');
  });

  it('passes production checks with real credentials', async () => {
    process.env.DATABASE_URL = 'https://db.example.com/mydb';
    process.env.NODE_ENV = 'production';
    process.env.S3_ACCESS_KEY = 'real-access-key';
    process.env.S3_SECRET_KEY = 'real-secret-key';
    process.env.SESSION_SECRET = 'a-real-production-secret-that-is-long-enough!!';

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const validateEnv = await importValidateEnv();
    const env = validateEnv();

    expect(env.NODE_ENV).toBe('production');
    warnSpy.mockRestore();
  });
});
