import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Crypto encrypt/decrypt roundtrip tests.
//
// These tests use the real node:crypto module (available in Node.js) and
// set the required env var (ENCRYPTION_KEY) for the key derivation to work.
// ---------------------------------------------------------------------------

describe('encrypt / decrypt', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Set a valid encryption key (must be >= 32 chars)
    process.env.ENCRYPTION_KEY = 'test-encryption-key-that-is-at-least-32-characters-long!!';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function importCrypto() {
    return await import('./crypto');
  }

  it('roundtrip: encrypts and decrypts a simple string', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const plaintext = 'Hello, World!';
    const ciphertext = await encrypt(plaintext);
    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('roundtrip: encrypts and decrypts an API key', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const apiKey = 'sk-ant-api03-abc123def456';
    const ciphertext = await encrypt(apiKey);
    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toBe(apiKey);
  });

  it('roundtrip: handles long strings', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const longText = 'x'.repeat(10000);
    const ciphertext = await encrypt(longText);
    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toBe(longText);
  });

  it('roundtrip: handles special characters', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const special = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\';
    const ciphertext = await encrypt(special);
    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toBe(special);
  });

  it('roundtrip: handles unicode text', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const unicode = '\u4f60\u597d\u4e16\u754c \ud83d\ude80 caf\u00e9';
    const ciphertext = await encrypt(unicode);
    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toBe(unicode);
  });

  it('roundtrip: handles newlines and whitespace', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const multiline = 'line1\nline2\r\nline3\ttab';
    const ciphertext = await encrypt(multiline);
    const decrypted = await decrypt(ciphertext);
    expect(decrypted).toBe(multiline);
  });

  it('ciphertext is in iv:tag:encrypted format', async () => {
    const { encrypt } = await importCrypto();
    const ciphertext = await encrypt('test');
    const parts = ciphertext.split(':');
    expect(parts.length).toBe(3);

    // Each part should be base64 encoded
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
      // Base64 regex (standard base64 chars)
      expect(part).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });

  it('each encryption produces different ciphertext (random IV)', async () => {
    const { encrypt } = await importCrypto();
    const plaintext = 'same input';
    const ct1 = await encrypt(plaintext);
    const ct2 = await encrypt(plaintext);
    expect(ct1).not.toBe(ct2);
  });

  it('throws on encrypt with empty string', async () => {
    const { encrypt } = await importCrypto();
    await expect(encrypt('')).rejects.toThrow('Cannot encrypt empty string');
  });

  it('throws on decrypt with empty string', async () => {
    const { decrypt } = await importCrypto();
    await expect(decrypt('')).rejects.toThrow('Cannot decrypt empty string');
  });

  it('throws on decrypt with invalid format (missing parts)', async () => {
    const { decrypt } = await importCrypto();
    await expect(decrypt('onlyonepart')).rejects.toThrow('Invalid ciphertext format');
  });

  it('throws on decrypt with invalid format (two parts)', async () => {
    const { decrypt } = await importCrypto();
    await expect(decrypt('part1:part2')).rejects.toThrow('Invalid ciphertext format');
  });

  it('throws on decrypt with invalid format (four parts)', async () => {
    const { decrypt } = await importCrypto();
    await expect(decrypt('a:b:c:d')).rejects.toThrow('Invalid ciphertext format');
  });

  it('throws on decrypt with tampered ciphertext', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const ciphertext = await encrypt('secret');
    const parts = ciphertext.split(':');

    // Tamper with the encrypted data
    const tampered = `${parts[0]}:${parts[1]}:${Buffer.from('tampered').toString('base64')}`;
    await expect(decrypt(tampered)).rejects.toThrow();
  });

  it('throws on decrypt with tampered auth tag', async () => {
    const { encrypt, decrypt } = await importCrypto();
    const ciphertext = await encrypt('secret');
    const parts = ciphertext.split(':');

    // Tamper with the auth tag (must be 16 bytes)
    const fakeTag = Buffer.alloc(16, 0xff).toString('base64');
    const tampered = `${parts[0]}:${fakeTag}:${parts[2]}`;
    await expect(decrypt(tampered)).rejects.toThrow();
  });

  it('throws on decrypt with wrong IV length', async () => {
    const { decrypt } = await importCrypto();
    const wrongIv = Buffer.alloc(8).toString('base64'); // 8 bytes instead of 12
    const fakeTag = Buffer.alloc(16).toString('base64');
    const fakeData = Buffer.alloc(10).toString('base64');
    await expect(decrypt(`${wrongIv}:${fakeTag}:${fakeData}`)).rejects.toThrow('Invalid IV length');
  });

  it('throws on decrypt with wrong tag length', async () => {
    const { decrypt } = await importCrypto();
    const goodIv = Buffer.alloc(12).toString('base64'); // 12 bytes correct
    const wrongTag = Buffer.alloc(8).toString('base64'); // 8 bytes instead of 16
    const fakeData = Buffer.alloc(10).toString('base64');
    await expect(decrypt(`${goodIv}:${wrongTag}:${fakeData}`)).rejects.toThrow(
      'Invalid auth tag length',
    );
  });
});

describe('encrypt / decrypt key resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses ENCRYPTION_KEY when set', async () => {
    process.env.ENCRYPTION_KEY = 'primary-key-that-is-at-least-32-characters-long!!';
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.SESSION_SECRET;

    const { encrypt, decrypt } = await import('./crypto');
    const ct = await encrypt('test');
    const pt = await decrypt(ct);
    expect(pt).toBe('test');
  });

  it('falls back to BETTER_AUTH_SECRET', async () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.BETTER_AUTH_SECRET = 'fallback-secret-that-is-at-least-32-characters-long';
    delete process.env.SESSION_SECRET;

    const { encrypt, decrypt } = await import('./crypto');
    const ct = await encrypt('test');
    const pt = await decrypt(ct);
    expect(pt).toBe('test');
  });

  it('falls back to SESSION_SECRET', async () => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.BETTER_AUTH_SECRET;
    process.env.SESSION_SECRET = 'session-secret-that-is-at-least-32-characters-long';

    const { encrypt, decrypt } = await import('./crypto');
    const ct = await encrypt('test');
    const pt = await decrypt(ct);
    expect(pt).toBe('test');
  });

  it('throws when no encryption key is available', async () => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.SESSION_SECRET;

    const { encrypt } = await import('./crypto');
    await expect(encrypt('test')).rejects.toThrow('No encryption key available');
  });

  it('different keys produce different ciphertext that cannot be cross-decrypted', async () => {
    process.env.ENCRYPTION_KEY = 'key-alpha-that-is-at-least-32-characters-long-for-test!!!';
    const mod1 = await import('./crypto');
    const ct1 = await mod1.encrypt('secret');

    vi.resetModules();
    process.env.ENCRYPTION_KEY = 'key-bravo-that-is-at-least-32-characters-long-for-test!!!';
    const mod2 = await import('./crypto');

    // Decrypting with a different key should fail
    await expect(mod2.decrypt(ct1)).rejects.toThrow();
  });
});
