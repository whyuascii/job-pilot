import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Rate limiter edge case tests: concurrent requests, window boundaries,
// key isolation, and timing edge cases.
// ---------------------------------------------------------------------------

describe('checkRateLimit edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // We need fresh module state for each test to avoid inter-test pollution
  // of the in-memory limits store.
  async function getCheckRateLimit() {
    vi.resetModules();
    const mod = await import('./rate-limit');
    return mod.checkRateLimit;
  }

  it('allows a single request with maxRequests of 1', async () => {
    const checkRateLimit = await getCheckRateLimit();
    expect(() => checkRateLimit('single-req', 1)).not.toThrow();
  });

  it('throws on second request when maxRequests is 1', async () => {
    const checkRateLimit = await getCheckRateLimit();
    checkRateLimit('single-req-throw', 1);
    expect(() => checkRateLimit('single-req-throw', 1)).toThrow('Rate limit exceeded');
  });

  it('allows exactly maxRequests calls', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const max = 10;
    for (let i = 0; i < max; i++) {
      expect(() => checkRateLimit('exact-max', max)).not.toThrow();
    }
    // The next one should throw
    expect(() => checkRateLimit('exact-max', max)).toThrow('Rate limit exceeded');
  });

  it('isolates keys completely', async () => {
    const checkRateLimit = await getCheckRateLimit();
    // Exhaust one key
    checkRateLimit('key-isolation-a', 1);
    expect(() => checkRateLimit('key-isolation-a', 1)).toThrow();

    // Other key should be fine
    expect(() => checkRateLimit('key-isolation-b', 1)).not.toThrow();
  });

  it('handles many different keys without interference', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const keys = Array.from({ length: 100 }, (_, i) => `bulk-key-${i}`);
    for (const key of keys) {
      expect(() => checkRateLimit(key, 1)).not.toThrow();
    }
    // All keys should be exhausted now
    for (const key of keys) {
      expect(() => checkRateLimit(key, 1)).toThrow('Rate limit exceeded');
    }
  });

  it('resets counter after window expiry (60 seconds)', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const key = 'window-expiry';

    // Exhaust the limit
    checkRateLimit(key, 2);
    checkRateLimit(key, 2);
    expect(() => checkRateLimit(key, 2)).toThrow();

    // Advance 59 seconds - still within window
    vi.advanceTimersByTime(59_000);
    expect(() => checkRateLimit(key, 2)).toThrow();

    // Advance 2 more seconds (total 61s) - past window
    vi.advanceTimersByTime(2_000);
    expect(() => checkRateLimit(key, 2)).not.toThrow();
  });

  it('creates a fresh window with count=1 after expiry', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const key = 'fresh-window';

    checkRateLimit(key, 1);
    expect(() => checkRateLimit(key, 1)).toThrow();

    // Wait for window to expire
    vi.advanceTimersByTime(61_000);

    // First call in new window
    checkRateLimit(key, 1);
    // Second call should fail
    expect(() => checkRateLimit(key, 1)).toThrow();
  });

  it('includes correct retry-after value at start of window', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const key = 'retry-start';

    checkRateLimit(key, 1);
    try {
      checkRateLimit(key, 1);
      expect.unreachable('Should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/Rate limit exceeded/);
      expect(message).toMatch(/Try again in \d+ seconds/);
      // Should be close to 60 seconds since we just started the window
      const seconds = parseInt(message.match(/(\d+) seconds/)?.[1] ?? '0');
      expect(seconds).toBeGreaterThanOrEqual(59);
      expect(seconds).toBeLessThanOrEqual(60);
    }
  });

  it('retry-after decreases as time passes', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const key = 'retry-decrease';

    checkRateLimit(key, 1);

    // Advance 30 seconds
    vi.advanceTimersByTime(30_000);

    try {
      checkRateLimit(key, 1);
      expect.unreachable('Should have thrown');
    } catch (err) {
      const message = (err as Error).message;
      const seconds = parseInt(message.match(/(\d+) seconds/)?.[1] ?? '0');
      expect(seconds).toBeGreaterThanOrEqual(29);
      expect(seconds).toBeLessThanOrEqual(31);
    }
  });

  it('handles rapid sequential calls correctly', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const key = 'rapid-calls';
    const maxRequests = 100;

    // Make all requests as fast as possible
    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit(key, maxRequests);
    }

    // Next one should fail
    expect(() => checkRateLimit(key, maxRequests)).toThrow('Rate limit exceeded');
  });

  it('handles keys with special characters', async () => {
    const checkRateLimit = await getCheckRateLimit();
    const specialKeys = [
      'user:123:action',
      'tenant_abc/rate',
      'key with spaces',
      'key-with-\u00e9moji',
      'very/nested/key/path/here',
    ];

    for (const key of specialKeys) {
      expect(() => checkRateLimit(key, 5)).not.toThrow();
    }
  });

  it('handles empty string as key', async () => {
    const checkRateLimit = await getCheckRateLimit();
    expect(() => checkRateLimit('', 5)).not.toThrow();
  });

  it('window expiry is per-key, not global', async () => {
    const checkRateLimit = await getCheckRateLimit();

    // Exhaust key-a at T=0
    checkRateLimit('per-key-a', 1);
    expect(() => checkRateLimit('per-key-a', 1)).toThrow();

    // Advance 30 seconds, exhaust key-b
    vi.advanceTimersByTime(30_000);
    checkRateLimit('per-key-b', 1);
    expect(() => checkRateLimit('per-key-b', 1)).toThrow();

    // Advance 31 more seconds: key-a's window has expired, key-b's has not
    vi.advanceTimersByTime(31_000);

    expect(() => checkRateLimit('per-key-a', 1)).not.toThrow(); // reset
    expect(() => checkRateLimit('per-key-b', 1)).toThrow(); // still in window
  });

  it('handles maxRequests of very large value', async () => {
    const checkRateLimit = await getCheckRateLimit();
    // With a very large limit, should never throw
    for (let i = 0; i < 1000; i++) {
      expect(() => checkRateLimit('large-limit', Number.MAX_SAFE_INTEGER)).not.toThrow();
    }
  });
});
