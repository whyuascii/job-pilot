import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Tests for the createId() function pattern used across server files.
//
// The app uses two variants:
// 1. packages/db/src/utils.ts - uses crypto.randomBytes for DB IDs
// 2. apps/web/app/server/applications.ts (and others) - uses Math.random
//
// Both produce the format: `${timestamp_base36}_${random}`
// ---------------------------------------------------------------------------

describe('createId pattern (Math.random variant)', () => {
  // Re-create the function locally since it is not exported
  function createId(): string {
    const timestamp = Date.now().toString(36);
    const random =
      Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    return `${timestamp}_${random}`;
  }

  it('returns a string', () => {
    expect(typeof createId()).toBe('string');
  });

  it('contains an underscore separator', () => {
    const id = createId();
    expect(id).toContain('_');
  });

  it('has format: timestamp_random', () => {
    const id = createId();
    const parts = id.split('_');
    expect(parts.length).toBe(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it('timestamp portion is valid base36', () => {
    const id = createId();
    const timestamp = id.split('_')[0];
    // Should only contain [0-9a-z]
    expect(timestamp).toMatch(/^[0-9a-z]+$/);
  });

  it('random portion is valid base36', () => {
    const id = createId();
    const random = id.split('_')[1];
    expect(random).toMatch(/^[0-9a-z]+$/);
  });

  it('timestamp decodes to a reasonable epoch time', () => {
    const id = createId();
    const timestamp = id.split('_')[0];
    const epoch = parseInt(timestamp, 36);
    const now = Date.now();
    // Should be within 1 second of now
    expect(epoch).toBeGreaterThan(now - 1000);
    expect(epoch).toBeLessThanOrEqual(now);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(createId());
    }
    // With timestamp + 16 chars of randomness, collisions are extremely unlikely
    expect(ids.size).toBe(1000);
  });

  it('IDs are lexicographically sortable by creation time', () => {
    vi.useFakeTimers();
    const ids: string[] = [];

    for (let i = 0; i < 5; i++) {
      ids.push(createId());
      vi.advanceTimersByTime(1000);
    }

    vi.useRealTimers();

    // Since the timestamp is the prefix and base36 is monotonically increasing,
    // IDs created later should sort after IDs created earlier
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('is not a UUID format', () => {
    const id = createId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(id).not.toMatch(uuidRegex);
  });

  it('random portion has reasonable length', () => {
    // Math.random().toString(36).slice(2, 10) gives up to 8 chars each, so up to 16
    const id = createId();
    const random = id.split('_')[1];
    // Minimum would be around 10-16 chars
    expect(random.length).toBeGreaterThanOrEqual(8);
    expect(random.length).toBeLessThanOrEqual(16);
  });
});

describe('createId pattern (crypto.randomBytes variant)', () => {
  // Re-create the DB variant locally
  function createId(): string {
    // Use a mock-friendly approach
    const { randomBytes } = require('crypto');
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `${timestamp}_${random}`;
  }

  it('returns a string', () => {
    expect(typeof createId()).toBe('string');
  });

  it('random portion is exactly 16 hex characters', () => {
    const id = createId();
    const random = id.split('_')[1];
    expect(random).toMatch(/^[0-9a-f]{16}$/);
    expect(random.length).toBe(16);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(createId());
    }
    expect(ids.size).toBe(1000);
  });

  it('is not a UUID format', () => {
    const id = createId();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(id).not.toMatch(uuidRegex);
  });

  it('timestamp portion decodes to current epoch', () => {
    const id = createId();
    const timestamp = id.split('_')[0];
    const epoch = parseInt(timestamp, 36);
    const now = Date.now();
    expect(epoch).toBeGreaterThan(now - 1000);
    expect(epoch).toBeLessThanOrEqual(now);
  });
});
