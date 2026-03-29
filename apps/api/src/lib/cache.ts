import type Redis from 'ioredis';

const KEY_PREFIX = 'jp:';

let client: Redis | null = null;
let connectionFailed = false;

async function getClient(): Promise<Redis | null> {
  if (client) return client;
  if (connectionFailed) return null;

  try {
    const { default: IORedis } = await import('ioredis');
    const url = process.env.REDIS_URL ?? 'redis://:jobpilot@localhost:6379';

    const redis = new IORedis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });

    redis.on('error', () => {
      /* intentionally silent */
    });

    await redis.connect();
    client = redis;
    return client;
  } catch {
    connectionFailed = true;
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getClient();
    if (!redis) return null;

    const raw = await redis.get(`${KEY_PREFIX}${key}`);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = await getClient();
    if (!redis) return;

    await redis.set(`${KEY_PREFIX}${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // best-effort
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const redis = await getClient();
    if (!redis) return;

    await redis.del(`${KEY_PREFIX}${key}`);
  } catch {
    // best-effort
  }
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  try {
    const redis = await getClient();
    if (!redis) return;

    const fullPattern = `${KEY_PREFIX}${pattern}`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // best-effort
  }
}
