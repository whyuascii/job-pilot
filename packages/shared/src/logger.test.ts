import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We need to test with different LOG_LEVEL values, so we use dynamic imports
// and reset modules between tests.

describe('logger', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('with default log level (debug in test environment)', () => {
    // The module evaluates currentLevel at import time.
    // In the test environment (NODE_ENV not set to 'production' and LOG_LEVEL not set),
    // currentLevel defaults to 'debug', so all levels should log.

    let createLogger: typeof import('./logger').createLogger;

    beforeEach(async () => {
      vi.resetModules();
      // Ensure no LOG_LEVEL is set and NODE_ENV is not production so default is 'debug'
      vi.stubEnv('LOG_LEVEL', '');
      vi.stubEnv('NODE_ENV', 'test');
      const mod = await import('./logger');
      createLogger = mod.createLogger;
    });

    it('logs debug messages', () => {
      const logger = createLogger();
      logger.debug('debug message');
      expect(debugSpy).toHaveBeenCalledOnce();
      const output = debugSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('debug');
      expect(parsed.message).toBe('debug message');
    });

    it('logs info messages', () => {
      const logger = createLogger();
      logger.info('info message');
      expect(infoSpy).toHaveBeenCalledOnce();
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('info message');
    });

    it('logs warn messages', () => {
      const logger = createLogger();
      logger.warn('warn message');
      expect(warnSpy).toHaveBeenCalledOnce();
      const output = warnSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('warn');
      expect(parsed.message).toBe('warn message');
    });

    it('logs error messages', () => {
      const logger = createLogger();
      logger.error('error message');
      expect(errorSpy).toHaveBeenCalledOnce();
      const output = errorSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('error message');
    });

    it('outputs valid JSON format with timestamp, level, and message', () => {
      const logger = createLogger();
      logger.info('structured log');
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'info');
      expect(parsed).toHaveProperty('message', 'structured log');
      // Verify timestamp is a valid ISO string
      expect(() => new Date(parsed.timestamp).toISOString()).not.toThrow();
    });

    it('includes context fields in the JSON output', () => {
      const logger = createLogger();
      logger.info('with context', { tenantId: 'tenant-1', userId: 'user-42' });
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.tenantId).toBe('tenant-1');
      expect(parsed.userId).toBe('user-42');
    });

    it('merges default context from createLogger with per-call context', () => {
      const logger = createLogger({ tenantId: 'default-tenant' });
      logger.info('merged', { userId: 'user-1' });
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.tenantId).toBe('default-tenant');
      expect(parsed.userId).toBe('user-1');
    });

    it('per-call context overrides default context', () => {
      const logger = createLogger({ tenantId: 'default-tenant' });
      logger.info('override', { tenantId: 'override-tenant' });
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.tenantId).toBe('override-tenant');
    });

    it('child logger merges context with parent', () => {
      const parent = createLogger({ tenantId: 'tenant-1' });
      const child = parent.child({ userId: 'user-99' });
      child.info('child log');
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.tenantId).toBe('tenant-1');
      expect(parsed.userId).toBe('user-99');
    });

    it('child logger context overrides parent context', () => {
      const parent = createLogger({ tenantId: 'parent-tenant' });
      const child = parent.child({ tenantId: 'child-tenant' });
      child.info('child override');
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.tenantId).toBe('child-tenant');
    });

    it('child logger can add additional context per-call', () => {
      const parent = createLogger({ tenantId: 'tenant-1' });
      const child = parent.child({ userId: 'user-1' });
      child.info('extra context', { requestId: 'req-123' });
      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.tenantId).toBe('tenant-1');
      expect(parsed.userId).toBe('user-1');
      expect(parsed.requestId).toBe('req-123');
    });
  });

  describe('log level filtering with LOG_LEVEL=error', () => {
    let createLogger: typeof import('./logger').createLogger;

    beforeEach(async () => {
      vi.resetModules();
      vi.stubEnv('LOG_LEVEL', 'error');
      const mod = await import('./logger');
      createLogger = mod.createLogger;
    });

    it('suppresses debug messages', () => {
      const logger = createLogger();
      logger.debug('should not appear');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('suppresses info messages', () => {
      const logger = createLogger();
      logger.info('should not appear');
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('suppresses warn messages', () => {
      const logger = createLogger();
      logger.warn('should not appear');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('allows error messages', () => {
      const logger = createLogger();
      logger.error('error message');
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('log level filtering with LOG_LEVEL=warn', () => {
    let createLogger: typeof import('./logger').createLogger;

    beforeEach(async () => {
      vi.resetModules();
      vi.stubEnv('LOG_LEVEL', 'warn');
      const mod = await import('./logger');
      createLogger = mod.createLogger;
    });

    it('suppresses debug messages', () => {
      const logger = createLogger();
      logger.debug('nope');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('suppresses info messages', () => {
      const logger = createLogger();
      logger.info('nope');
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('allows warn messages', () => {
      const logger = createLogger();
      logger.warn('warning');
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('allows error messages', () => {
      const logger = createLogger();
      logger.error('error');
      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });
});
