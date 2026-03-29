import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset module state by re-importing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests within the limit', () => {
    const key = 'test-within-limit';
    expect(() => checkRateLimit(key, 5)).not.toThrow();
    expect(() => checkRateLimit(key, 5)).not.toThrow();
    expect(() => checkRateLimit(key, 5)).not.toThrow();
  });

  it('allows exactly maxRequests calls', () => {
    const key = 'test-exact-limit';
    for (let i = 0; i < 3; i++) {
      expect(() => checkRateLimit(key, 3)).not.toThrow();
    }
  });

  it('throws when requests exceed the limit', () => {
    const key = 'test-exceed-limit';
    // Use up the limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5);
    }
    // The next call should throw
    expect(() => checkRateLimit(key, 5)).toThrow('Rate limit exceeded');
  });

  it('includes retry-after seconds in the error message', () => {
    const key = 'test-retry-after';
    // Advance 10 seconds into the window
    vi.advanceTimersByTime(10_000);

    checkRateLimit(key, 1);

    // Advance 5 more seconds (still within the 60s window)
    vi.advanceTimersByTime(5_000);

    try {
      checkRateLimit(key, 1);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect((err as Error).message).toMatch(/Try again in \d+ seconds/);
    }
  });

  it('treats different keys independently', () => {
    const keyA = 'key-a';
    const keyB = 'key-b';

    // Exhaust keyA
    checkRateLimit(keyA, 1);
    expect(() => checkRateLimit(keyA, 1)).toThrow('Rate limit exceeded');

    // keyB should still work
    expect(() => checkRateLimit(keyB, 1)).not.toThrow();
  });

  it('resets after the time window expires', () => {
    const key = 'test-window-expiry';

    // Use up the limit
    checkRateLimit(key, 2);
    checkRateLimit(key, 2);
    expect(() => checkRateLimit(key, 2)).toThrow('Rate limit exceeded');

    // Advance past the 60-second window
    vi.advanceTimersByTime(61_000);

    // Should work again after window resets
    expect(() => checkRateLimit(key, 2)).not.toThrow();
  });

  it('starts a new window after expiration with count of 1', () => {
    const key = 'test-new-window';

    checkRateLimit(key, 1);
    expect(() => checkRateLimit(key, 1)).toThrow('Rate limit exceeded');

    // Advance past the window
    vi.advanceTimersByTime(61_000);

    // First call in new window succeeds
    expect(() => checkRateLimit(key, 1)).not.toThrow();

    // Second call in new window exceeds limit of 1
    expect(() => checkRateLimit(key, 1)).toThrow('Rate limit exceeded');
  });
});
