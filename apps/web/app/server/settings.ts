import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { db } from '@job-pilot/db';
import { jobSources } from '@job-pilot/db/schema';
import { getTenantContext } from '~/lib/api';
import { decrypt, encrypt } from '~/lib/crypto';
import { checkRateLimit } from '~/lib/rate-limit';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

// ---------------------------------------------------------------------------
// In-memory store for encrypted API keys set via the UI.
// In production, these would be persisted in a database table (e.g.,
// tenant_settings). For now, env-var keys are the primary source and
// UI-saved keys override them at runtime.
// ---------------------------------------------------------------------------
const encryptedKeyStore: Record<string, string> = {};

/**
 * Mask an API key for safe display. Only shows the last 4 characters.
 * Returns a string like "****...abcd".
 */
function maskApiKey(key: string): string {
  if (key.length <= 4) {
    return '****';
  }
  return `****...${key.slice(-4)}`;
}

/**
 * Resolve a raw (plaintext) API key for a given service.
 *
 * Priority:
 * 1. If an encrypted key was saved via the UI, decrypt and return it.
 * 2. Fall back to the environment variable.
 *
 * Returns `null` if no key is available.
 */
async function resolveRawApiKey(service: string, envVar: string): Promise<string | null> {
  const stored = encryptedKeyStore[service];
  if (stored) {
    try {
      return await decrypt(stored);
    } catch {
      console.warn(
        `[settings] Failed to decrypt stored key for ${service}, falling back to env var`,
      );
    }
  }
  return process.env[envVar] || null;
}

/**
 * Get a decrypted API key for internal use (e.g., making Anthropic API calls).
 * This is NOT a server function -- it is a plain helper for server-side code.
 *
 * @param service - The service identifier: "anthropic" or "firecrawl"
 * @returns The plaintext API key, or null if not configured
 */
export async function getDecryptedApiKey(
  service: 'anthropic' | 'firecrawl',
): Promise<string | null> {
  const envVarMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    firecrawl: 'FIRECRAWL_API_KEY',
  };
  return resolveRawApiKey(service, envVarMap[service]);
}

/**
 * Check which API keys are configured.
 * Returns `{ hasKey, maskedKey }` for each service -- never the actual key.
 */
export const getApiKeyStatus = createServerFn({ method: 'GET' }).handler(async () => {
  await getTenantContext(); // ensure authenticated

  const anthropicKey = await resolveRawApiKey('anthropic', 'ANTHROPIC_API_KEY');
  const firecrawlKey = await resolveRawApiKey('firecrawl', 'FIRECRAWL_API_KEY');

  return {
    anthropic: {
      hasKey: !!anthropicKey,
      maskedKey: anthropicKey ? maskApiKey(anthropicKey) : null,
    },
    firecrawl: {
      hasKey: !!firecrawlKey,
      maskedKey: firecrawlKey ? maskApiKey(firecrawlKey) : null,
    },
    s3: {
      configured: !!(process.env.S3_ENDPOINT || process.env.AWS_REGION),
      endpoint: process.env.S3_ENDPOINT
        ? 'MinIO (local)'
        : process.env.AWS_REGION
          ? `AWS (${process.env.AWS_REGION})`
          : null,
    },
  };
});

/**
 * Save an API key for a service. The key is encrypted before being stored.
 * Pass an empty string to remove a previously saved key.
 */
export const saveApiKey = createServerFn({ method: 'POST' })
  .validator((data: { service: 'anthropic' | 'firecrawl'; apiKey: string }) => data)
  .handler(async ({ data }) => {
    await getTenantContext(); // ensure authenticated

    if (!['anthropic', 'firecrawl'].includes(data.service)) {
      throw new Error(`Unknown service: ${data.service}`);
    }

    if (data.apiKey.trim() === '') {
      // Remove the stored key; will fall back to env var
      delete encryptedKeyStore[data.service];
      const remaining = await resolveRawApiKey(
        data.service,
        data.service === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'FIRECRAWL_API_KEY',
      );
      return { success: true, hasKey: !!remaining };
    }

    // Encrypt and store
    encryptedKeyStore[data.service] = await encrypt(data.apiKey.trim());

    return { success: true, hasKey: true };
  });

/**
 * List all job sources for the current tenant.
 */
export const listJobSources = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const sources = await db.query.jobSources.findMany({
    where: eq(jobSources.tenantId, ctx.tenantId),
  });

  return sources;
});

/**
 * Add a new job source for the current tenant.
 */
export const addJobSource = createServerFn({ method: 'POST' })
  .validator((data: { name: string; type: string; url?: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    const [source] = await db
      .insert(jobSources)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        name: data.name,
        type: data.type,
        config: data.url ? { url: data.url } : {},
        enabled: true,
      })
      .returning();

    return source;
  });

/**
 * Delete a job source (must belong to current tenant).
 */
export const deleteJobSource = createServerFn({ method: 'POST' })
  .validator((data: { sourceId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    await db
      .delete(jobSources)
      .where(and(eq(jobSources.id, data.sourceId), eq(jobSources.tenantId, ctx.tenantId)));

    return { success: true };
  });

/**
 * Toggle a job source's enabled status.
 */
export const toggleJobSource = createServerFn({ method: 'POST' })
  .validator((data: { sourceId: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    const [updated] = await db
      .update(jobSources)
      .set({ enabled: data.enabled })
      .where(and(eq(jobSources.id, data.sourceId), eq(jobSources.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) {
      throw new Error('Job source not found');
    }

    return updated;
  });

// ---------------------------------------------------------------------------
// Job Source Sync
// ---------------------------------------------------------------------------

export interface SyncResult {
  sourceId: string;
  sourceName: string;
  jobsFound: number;
  newJobs: number;
  duplicates: number;
  errors: string[];
}

/** Internal sync logic for a single source, shared by syncJobSource and syncAllSources. */
async function syncJobSourceInternal(
  sourceId: string,
  ctx: { tenantId: string; userId: string },
): Promise<SyncResult> {
  // 1. Load the source record
  const source = await db.query.jobSources.findFirst({
    where: and(eq(jobSources.id, sourceId), eq(jobSources.tenantId, ctx.tenantId)),
  });

  if (!source) {
    throw new Error('Job source not found');
  }

  if (!source.enabled) {
    throw new Error('Job source is disabled. Enable it before syncing.');
  }

  const config = source.config as { url?: string; urls?: string[] };
  const urls: string[] = [];

  if (config.url) urls.push(config.url);
  if (config.urls) urls.push(...config.urls);

  if (urls.length === 0) {
    throw new Error('Job source has no URL configured. Edit the source and add a URL.');
  }

  // 2. Ingest each URL
  const result: SyncResult = {
    sourceId: source.id,
    sourceName: source.name,
    jobsFound: 0,
    newJobs: 0,
    duplicates: 0,
    errors: [],
  };

  for (const url of urls) {
    try {
      const { ingestJobFromUrlInternal } = await import('./ai');
      const ingested = await ingestJobFromUrlInternal(url, ctx);

      // Handle search page results (multiple jobs extracted from one URL)
      if ((ingested as any).isSearchPage) {
        const extracted = (ingested as any).jobs || [];
        result.jobsFound += extracted.length;
        for (const job of extracted) {
          if ((job as any).deduplicated) {
            result.duplicates++;
          } else {
            result.newJobs++;
          }
        }
      } else {
        result.jobsFound++;
        if (ingested.deduplicated) {
          result.duplicates++;
        } else {
          result.newJobs++;
        }
      }
    } catch (err) {
      result.errors.push(`${url}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // 3. Update lastSyncAt regardless of individual URL outcomes
  await db.update(jobSources).set({ lastSyncAt: new Date() }).where(eq(jobSources.id, source.id));

  return result;
}

/**
 * Sync a single job source by fetching its URL(s) and ingesting any new jobs.
 * Updates the source's lastSyncAt timestamp on completion.
 */
export const syncJobSource = createServerFn({ method: 'POST' })
  .validator((data: { sourceId: string }) => data)
  .handler(async ({ data }): Promise<SyncResult> => {
    const ctx = await getTenantContext();
    checkRateLimit(`syncJobSource:${ctx.tenantId}`, 5);
    return syncJobSourceInternal(data.sourceId, ctx);
  });

/**
 * Sync all enabled job sources for the current tenant.
 * Processes sources sequentially to avoid rate-limiting.
 * Returns a summary of results per source.
 */
export const syncAllSources = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{
    results: SyncResult[];
    totalNewJobs: number;
    totalErrors: number;
  }> => {
    const ctx = await getTenantContext();
    checkRateLimit(`syncAllSources:${ctx.tenantId}`, 2);

    // Load all enabled sources with URLs
    const sources = await db.query.jobSources.findMany({
      where: and(eq(jobSources.tenantId, ctx.tenantId), eq(jobSources.enabled, true)),
    });

    const sourcesWithUrls = sources.filter((s) => {
      const config = s.config as { url?: string; urls?: string[] };
      return config.url || (config.urls && config.urls.length > 0);
    });

    if (sourcesWithUrls.length === 0) {
      return { results: [], totalNewJobs: 0, totalErrors: 0 };
    }

    const results: SyncResult[] = [];

    // Process each source sequentially
    for (const source of sourcesWithUrls) {
      try {
        const result = await syncJobSourceInternal(source.id, ctx);
        results.push(result);
      } catch (err) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          jobsFound: 0,
          newJobs: 0,
          duplicates: 0,
          errors: [err instanceof Error ? err.message : 'Unknown error'],
        });
      }
    }

    return {
      results,
      totalNewJobs: results.reduce((sum, r) => sum + r.newJobs, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    };
  },
);
