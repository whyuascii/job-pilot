const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits - recommended for GCM
const TAG_LENGTH = 16; // 128 bits - standard auth tag length

async function getCrypto() {
  return await import('node:crypto');
}

/**
 * Derive a 32-byte encryption key from the configured secret.
 */
async function getEncryptionKey(): Promise<Buffer> {
  const secret =
    process.env.ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      'No encryption key available. Set ENCRYPTION_KEY, BETTER_AUTH_SECRET, or SESSION_SECRET in your environment.',
    );
  }

  const { createHash } = await getCrypto();
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string in the format `iv:tag:ciphertext` (all base64).
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  const { createCipheriv, randomBytes } = await getCrypto();
  const key = await getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt a ciphertext string that was encrypted with {@link encrypt}.
 * Expects the input in the format `iv:tag:ciphertext` (all base64).
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    throw new Error('Cannot decrypt empty string');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format. Expected "iv:tag:ciphertext" (base64-encoded).');
  }

  const [ivB64, tagB64, encryptedB64] = parts;

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${TAG_LENGTH} bytes, got ${tag.length}`);
  }

  const { createDecipheriv } = await getCrypto();
  const key = await getEncryptionKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error(
      'Decryption failed. The ciphertext may be corrupted or the encryption key may have changed.',
    );
  }
}
