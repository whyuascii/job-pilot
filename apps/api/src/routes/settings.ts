import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import {
  apiKeys,
  candidates,
  experienceBlocks,
  jobs,
  jobScores,
  jobSources,
  skills,
} from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { decrypt, encrypt } from '../lib/crypto.js';
import { checkRateLimit } from '../lib/rate-limit.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return `****...${key.slice(-4)}`;
}

const ALLOWED_SERVICES = ['anthropic', 'firecrawl', 'adzuna', 'serpapi'];

const ENV_VAR_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  firecrawl: 'FIRECRAWL_API_KEY',
  adzuna: 'ADZUNA_API_KEY', // format: appId:appKey
  serpapi: 'SERPAPI_API_KEY',
};

async function resolveRawApiKey(service: string, tenantId: string): Promise<string | null> {
  try {
    const record = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.service, service)),
    });
    if (record) {
      return await decrypt(record.encryptedKey);
    }
  } catch {
    // DB lookup failed, fall through to env
  }
  return process.env[ENV_VAR_MAP[service]] || null;
}

export async function getDecryptedApiKey(
  service: 'anthropic' | 'firecrawl' | 'adzuna' | 'serpapi',
): Promise<string | null> {
  try {
    const ctx = getTenantContext();
    return resolveRawApiKey(service, ctx.tenantId);
  } catch {
    return process.env[ENV_VAR_MAP[service]] || null;
  }
}

// ---------------------------------------------------------------------------
// Ingest a scraped job (from ts-jobspy or Adzuna) into the database
// ---------------------------------------------------------------------------

interface ScrapedJobData {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  remotePolicy?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  source: string;
}

async function ingestScrapedJob(
  job: ScrapedJobData,
  ctx: { tenantId: string; userId: string },
  sourceId?: string,
): Promise<{ deduplicated: boolean; jobId: string }> {
  // Deduplicate by source URL
  if (job.url) {
    const existingByUrl = await db.query.jobs.findFirst({
      where: and(eq(jobs.tenantId, ctx.tenantId), eq(jobs.sourceUrl, job.url)),
    });
    if (existingByUrl) return { deduplicated: true, jobId: existingByUrl.id };
  }

  // Deduplicate by company + title
  const existing = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.tenantId, ctx.tenantId),
      eq(jobs.company, job.company),
      eq(jobs.title, job.title),
    ),
  });
  if (existing) return { deduplicated: true, jobId: existing.id };

  const [inserted] = await db
    .insert(jobs)
    .values({
      tenantId: ctx.tenantId,
      company: job.company,
      title: job.title,
      location: job.location || '',
      remotePolicy: job.remotePolicy || 'unknown',
      employmentType: job.employmentType || 'full_time',
      compensationMin: job.salaryMin ?? null,
      compensationMax: job.salaryMax ?? null,
      compensationCurrency: job.salaryCurrency || null,
      applyUrl: job.url || '',
      sourceUrl: job.url || `scraped:${job.source}:${Date.now()}`,
      rawDescription: job.description || '',
      sourceId: sourceId ?? null,
    })
    .returning();

  return { deduplicated: false, jobId: inserted.id };
}

// ---------------------------------------------------------------------------
// Sync a single source — handles URL-based, ts-jobspy, and Adzuna
// ---------------------------------------------------------------------------

async function syncSource(
  source: any,
  ctx: { tenantId: string; userId: string },
): Promise<{
  sourceId: string;
  sourceName: string;
  jobsFound: number;
  newJobs: number;
  duplicates: number;
  errors: string[];
}> {
  const config = source.config as any;
  const result = {
    sourceId: source.id,
    sourceName: source.name,
    jobsFound: 0,
    newJobs: 0,
    duplicates: 0,
    errors: [] as string[],
  };

  // --- Search-based sync (supports multiple search terms) ---
  const searchTerms: string[] =
    config.searchTerms || (config.searchTerm ? [config.searchTerm] : []);

  if (searchTerms.length > 0) {
    const searchType = source.type;
    const seenUrls = new Set<string>();

    for (const term of searchTerms) {
      if (searchType === 'serpapi') {
        try {
          const serpApiKey = await resolveRawApiKey('serpapi', ctx.tenantId);
          if (!serpApiKey) throw new Error('SerpAPI key not configured. Add it in Settings.');
          const { searchWithSerpApi } = await import('../lib/job-scrapers.js');
          const scraped = await searchWithSerpApi(
            {
              searchTerm: term,
              location: config.location,
              country: config.country || 'us',
              language: config.language || 'en',
              maxPages: config.maxPages || 3,
            },
            serpApiKey,
          );
          result.jobsFound += scraped.length;
          for (const job of scraped) {
            if (job.url && seenUrls.has(job.url)) {
              result.duplicates++;
              continue;
            }
            if (job.url) seenUrls.add(job.url);
            try {
              const { deduplicated } = await ingestScrapedJob(job, ctx, source.id);
              if (deduplicated) result.duplicates++;
              else result.newJobs++;
            } catch (err) {
              result.errors.push(`${job.title}: ${err instanceof Error ? err.message : 'Unknown'}`);
            }
          }
        } catch (err) {
          result.errors.push(
            `SerpAPI (${term}): ${err instanceof Error ? err.message : 'Unknown'}`,
          );
        }
      } else if (searchType === 'adzuna') {
        try {
          const adzunaKey = await resolveRawApiKey('adzuna', ctx.tenantId);
          if (!adzunaKey)
            throw new Error(
              'Adzuna API key not configured. Add it in Settings (format: appId:appKey).',
            );
          const { searchWithAdzuna, parseAdzunaCredentials } =
            await import('../lib/job-scrapers.js');
          const creds = parseAdzunaCredentials(adzunaKey);
          if (!creds) throw new Error('Invalid Adzuna API key format. Expected "appId:appKey".');
          const scraped = await searchWithAdzuna(
            {
              searchTerm: term,
              location: config.location,
              country: config.country || 'us',
              resultsPerPage: Math.min(config.resultsPerPage || 50, 25),
              maxDaysOld: config.maxDaysOld || 30,
              salaryMin: config.salaryMin,
              fullTime: config.fullTime,
              sortBy: config.sortBy || 'date',
            },
            creds,
          );
          result.jobsFound += scraped.length;
          for (const job of scraped) {
            if (job.url && seenUrls.has(job.url)) {
              result.duplicates++;
              continue;
            }
            if (job.url) seenUrls.add(job.url);
            try {
              const { deduplicated } = await ingestScrapedJob(job, ctx, source.id);
              if (deduplicated) result.duplicates++;
              else result.newJobs++;
            } catch (err) {
              result.errors.push(`${job.title}: ${err instanceof Error ? err.message : 'Unknown'}`);
            }
          }
        } catch (err) {
          result.errors.push(`Adzuna (${term}): ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      } else if (searchType === 'linkedin' || searchType === 'indeed') {
        try {
          const { searchWithTsJobspy } = await import('../lib/job-scrapers.js');
          const scraped = await searchWithTsJobspy({
            searchTerm: term,
            location: config.location,
            resultsWanted: Math.min(config.resultsWanted || 200, 50),
            isRemote: config.isRemote,
            jobType: config.jobType,
            hoursOld: config.hoursOld || 168,
            sites: [searchType],
          });
          result.jobsFound += scraped.length;
          for (const job of scraped) {
            if (job.url && seenUrls.has(job.url)) {
              result.duplicates++;
              continue;
            }
            if (job.url) seenUrls.add(job.url);
            try {
              const { deduplicated } = await ingestScrapedJob(job, ctx, source.id);
              if (deduplicated) result.duplicates++;
              else result.newJobs++;
            } catch (err) {
              result.errors.push(`${job.title}: ${err instanceof Error ? err.message : 'Unknown'}`);
            }
          }
        } catch (err) {
          result.errors.push(
            `ts-jobspy (${term}): ${err instanceof Error ? err.message : 'Unknown'}`,
          );
        }
      }
    }
  }

  // --- URL-based sync (existing behavior) ---
  const urls: string[] = [];
  if (config.url) urls.push(config.url);
  if (config.urls) urls.push(...config.urls);

  if (urls.length > 0) {
    const { ingestJobFromUrlInternal } = await import('./ai.js');
    for (const url of urls) {
      try {
        const ingested = await ingestJobFromUrlInternal(url, ctx);
        if ((ingested as any).isSearchPage) {
          const extracted = (ingested as any).jobs || [];
          result.jobsFound += extracted.length;
          for (const job of extracted) {
            if ((job as any).deduplicated) result.duplicates++;
            else result.newJobs++;
          }
        } else {
          result.jobsFound++;
          if ((ingested as any).deduplicated) result.duplicates++;
          else result.newJobs++;
        }
      } catch (err) {
        result.errors.push(`${url}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }
  }

  // If neither search nor URL config exists, report it
  if (searchTerms.length === 0 && urls.length === 0) {
    result.errors.push('No search term or URL configured.');
  }

  await db.update(jobSources).set({ lastSyncAt: new Date() }).where(eq(jobSources.id, source.id));
  return result;
}

// ---------------------------------------------------------------------------
// Generate diverse, broad search terms from candidate profile
// ---------------------------------------------------------------------------

async function generateDiverseSearchTerms(
  candidate: { currentTitle: string; headline: string; location: string },
  topSkills: Array<{ name: string; category: string; confidenceScore: number }>,
  experienceTitles: string[],
): Promise<string[]> {
  const terms = new Set<string>();
  const title = (candidate.currentTitle || '').trim();
  const headline = (candidate.headline || '').trim();

  // 1. Current title
  if (title) terms.add(title);

  // 2. Strip seniority for broader base title
  const baseTitle = title
    .replace(/^(senior|sr\.?|junior|jr\.?|lead|principal|staff|chief|head of)\s+/i, '')
    .trim();
  if (baseTitle && baseTitle.toLowerCase() !== title.toLowerCase()) {
    terms.add(baseTitle);
  }

  // 3. Title synonyms — map common role keywords to alternatives
  const synonymPairs: [RegExp, string[]][] = [
    [/software engineer/i, ['Software Developer', 'Application Developer']],
    [/software developer/i, ['Software Engineer', 'Application Developer']],
    [/full\s*stack/i, ['Full Stack Developer', 'Web Developer']],
    [/front\s*end|frontend/i, ['Frontend Developer', 'UI Developer', 'Web Developer']],
    [/back\s*end|backend/i, ['Backend Developer', 'API Developer', 'Server Engineer']],
    [/data scientist/i, ['Machine Learning Engineer', 'AI Engineer', 'Data Analyst']],
    [/data engineer/i, ['Analytics Engineer', 'ETL Developer', 'Data Platform Engineer']],
    [/machine learning/i, ['ML Engineer', 'AI Engineer', 'Data Scientist']],
    [/devops/i, ['Site Reliability Engineer', 'Platform Engineer', 'Infrastructure Engineer']],
    [/sre|site reliability/i, ['DevOps Engineer', 'Platform Engineer', 'Infrastructure Engineer']],
    [/product manager/i, ['Program Manager', 'Product Owner', 'Technical Product Manager']],
    [/designer/i, ['UX Designer', 'UI Designer', 'Product Designer']],
    [/mobile/i, ['Mobile Developer', 'iOS Developer', 'Android Developer']],
    [/cloud/i, ['Cloud Engineer', 'DevOps Engineer', 'Infrastructure Engineer']],
    [/security/i, ['Security Engineer', 'Cybersecurity Analyst', 'InfoSec Engineer']],
    [/qa|quality/i, ['QA Engineer', 'Test Engineer', 'SDET']],
    [/embedded/i, ['Embedded Engineer', 'Firmware Engineer', 'Systems Engineer']],
  ];

  const lowerTitle = title.toLowerCase();
  for (const [pattern, synonyms] of synonymPairs) {
    if (pattern.test(lowerTitle) || pattern.test(baseTitle.toLowerCase())) {
      for (const syn of synonyms) {
        terms.add(syn);
        if (terms.size >= 12) break;
      }
    }
    if (terms.size >= 12) break;
  }

  // 4. Past job titles (unique, different from current)
  for (const pastTitle of experienceTitles) {
    const cleaned = pastTitle.trim();
    if (cleaned && cleaned.toLowerCase() !== title.toLowerCase()) {
      terms.add(cleaned);
      if (terms.size >= 12) break;
    }
  }

  // 5. Skill + role combos (top technical skills only)
  const techSkills = topSkills
    .filter((s) => ['language', 'framework', 'tool', 'platform'].includes(s.category))
    .slice(0, 4);
  for (const skill of techSkills) {
    terms.add(`${skill.name} Developer`);
    if (terms.size >= 12) break;
  }

  // 6. Headline if meaningfully different
  if (headline && headline.toLowerCase() !== title.toLowerCase() && headline.length < 60) {
    terms.add(headline);
  }

  // Return max 10 unique terms
  return [...terms].slice(0, 10);
}

const router = Router();

// ---------------------------------------------------------------------------
// API Key management
// ---------------------------------------------------------------------------

router.get('/api-key-status', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const anthropicKey = await resolveRawApiKey('anthropic', ctx.tenantId);
    const firecrawlKey = await resolveRawApiKey('firecrawl', ctx.tenantId);
    const adzunaKey = await resolveRawApiKey('adzuna', ctx.tenantId);
    const serpApiKey = await resolveRawApiKey('serpapi', ctx.tenantId);
    res.json({
      anthropic: {
        hasKey: !!anthropicKey,
        maskedKey: anthropicKey ? maskApiKey(anthropicKey) : null,
      },
      firecrawl: {
        hasKey: !!firecrawlKey,
        maskedKey: firecrawlKey ? maskApiKey(firecrawlKey) : null,
      },
      adzuna: { hasKey: !!adzunaKey, maskedKey: adzunaKey ? maskApiKey(adzunaKey) : null },
      serpapi: { hasKey: !!serpApiKey, maskedKey: serpApiKey ? maskApiKey(serpApiKey) : null },
      s3: {
        configured: !!(process.env.S3_ENDPOINT || process.env.AWS_REGION),
        endpoint: process.env.S3_ENDPOINT
          ? 'MinIO (local)'
          : process.env.AWS_REGION
            ? `AWS (${process.env.AWS_REGION})`
            : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post('/save-api-key', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { service, apiKey } = req.body;
    if (!ALLOWED_SERVICES.includes(service)) throw new Error(`Unknown service: ${service}`);

    if (!apiKey || apiKey.trim() === '') {
      await db
        .delete(apiKeys)
        .where(and(eq(apiKeys.tenantId, ctx.tenantId), eq(apiKeys.service, service)));
      const hasEnvKey = !!process.env[ENV_VAR_MAP[service]];
      res.json({ success: true, hasKey: hasEnvKey });
      return;
    }

    const encryptedValue = await encrypt(apiKey.trim());

    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.tenantId, ctx.tenantId), eq(apiKeys.service, service)));
    await db.insert(apiKeys).values({
      id: createId(),
      tenantId: ctx.tenantId,
      service,
      encryptedKey: encryptedValue,
    });

    res.json({ success: true, hasKey: true });
  } catch (e) {
    next(e);
  }
});

router.post('/delete-api-key', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { service } = req.body;
    if (!ALLOWED_SERVICES.includes(service)) throw new Error(`Unknown service: ${service}`);
    await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.tenantId, ctx.tenantId), eq(apiKeys.service, service)));
    const hasEnvKey = !!process.env[ENV_VAR_MAP[service]];
    res.json({ success: true, hasKey: hasEnvKey, source: hasEnvKey ? 'env' : null });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Auto-generate search config from profile
// ---------------------------------------------------------------------------

router.get('/search-config', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();

    const candidate = await db.query.candidates.findFirst({
      where: eq(candidates.tenantId, ctx.tenantId),
    });
    if (!candidate) {
      res.json({ searchTerms: [], location: '', isRemote: false });
      return;
    }

    const [topSkills, experience] = await Promise.all([
      db.query.skills.findMany({
        where: eq(skills.candidateId, candidate.id),
        orderBy: [desc(skills.confidenceScore)],
        limit: 10,
      }),
      db.query.experienceBlocks.findMany({
        where: eq(experienceBlocks.candidateId, candidate.id),
        orderBy: [desc(experienceBlocks.startDate)],
        limit: 5,
      }),
    ]);

    const experienceTitles = [...new Set(experience.map((e) => e.title))];
    const searchTerms = await generateDiverseSearchTerms(candidate, topSkills, experienceTitles);

    const isRemote = candidate.remotePreference === 'remote';

    res.json({
      searchTerms,
      location: candidate.location || '',
      isRemote,
      remotePreference: candidate.remotePreference || 'flexible',
      currentTitle: candidate.currentTitle || '',
      topSkills: topSkills
        .filter((s) => ['language', 'framework', 'tool', 'platform'].includes(s.category))
        .slice(0, 5)
        .map((s) => s.name),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/enable-source', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { type } = req.body;

    const validTypes = ['linkedin', 'indeed', 'serpapi', 'adzuna'];
    if (!validTypes.includes(type)) throw new Error(`Invalid source type: ${type}`);

    const existing = await db.query.jobSources.findFirst({
      where: and(eq(jobSources.tenantId, ctx.tenantId), eq(jobSources.type, type)),
    });
    if (existing) {
      res.json(existing);
      return;
    }

    const candidate = await db.query.candidates.findFirst({
      where: eq(candidates.tenantId, ctx.tenantId),
    });

    let searchTerms: string[] = ['software engineer'];
    let location = '';

    if (candidate) {
      const [topSkills, experience] = await Promise.all([
        db.query.skills.findMany({
          where: eq(skills.candidateId, candidate.id),
          orderBy: [desc(skills.confidenceScore)],
          limit: 10,
        }),
        db.query.experienceBlocks.findMany({
          where: eq(experienceBlocks.candidateId, candidate.id),
          orderBy: [desc(experienceBlocks.startDate)],
          limit: 5,
        }),
      ]);

      const experienceTitles = [...new Set(experience.map((e) => e.title))];
      searchTerms = await generateDiverseSearchTerms(candidate, topSkills, experienceTitles);
      location = candidate.location || '';
    }

    if (searchTerms.length === 0) searchTerms = ['software engineer'];

    const typeLabels: Record<string, string> = {
      linkedin: 'LinkedIn',
      indeed: 'Indeed',
      serpapi: 'Google Jobs',
      adzuna: 'Adzuna',
    };

    const [source] = await db
      .insert(jobSources)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        name: typeLabels[type] || type,
        type,
        config: {
          searchTerm: searchTerms[0],
          searchTerms,
          location,
          isRemote: candidate?.remotePreference === 'remote',
          country: 'us',
        },
        enabled: true,
      })
      .returning();

    res.json(source);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Job Sources CRUD
// ---------------------------------------------------------------------------

router.get('/job-sources', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    res.json(await db.query.jobSources.findMany({ where: eq(jobSources.tenantId, ctx.tenantId) }));
  } catch (e) {
    next(e);
  }
});

router.post('/job-sources', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const config: Record<string, any> = {};
    if (req.body.url) config.url = req.body.url;
    if (req.body.searchTerm) config.searchTerm = req.body.searchTerm;
    if (req.body.location) config.location = req.body.location;
    if (req.body.country) config.country = req.body.country;
    if (req.body.isRemote != null) config.isRemote = req.body.isRemote;

    const [source] = await db
      .insert(jobSources)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        name: req.body.name,
        type: req.body.type,
        config,
        enabled: true,
      })
      .returning();
    res.json(source);
  } catch (e) {
    next(e);
  }
});

router.post('/job-sources/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    await db
      .delete(jobSources)
      .where(and(eq(jobSources.id, req.body.sourceId), eq(jobSources.tenantId, ctx.tenantId)));
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/job-sources/toggle', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const [updated] = await db
      .update(jobSources)
      .set({ enabled: req.body.enabled })
      .where(and(eq(jobSources.id, req.body.sourceId), eq(jobSources.tenantId, ctx.tenantId)))
      .returning();
    if (!updated) throw new Error('Job source not found');
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Source Sync
// ---------------------------------------------------------------------------

router.post('/job-sources/sync', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`syncJobSource:${ctx.tenantId}`, 5);
    const source = await db.query.jobSources.findFirst({
      where: and(eq(jobSources.id, req.body.sourceId), eq(jobSources.tenantId, ctx.tenantId)),
    });
    if (!source) throw new Error('Job source not found');
    if (!source.enabled) throw new Error('Job source is disabled.');
    res.json(await syncSource(source, ctx));
  } catch (e) {
    next(e);
  }
});

router.post('/job-sources/sync-all', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`syncAllSources:${ctx.tenantId}`, 2);
    const sources = await db.query.jobSources.findMany({
      where: and(eq(jobSources.tenantId, ctx.tenantId), eq(jobSources.enabled, true)),
    });
    // Filter to sources that have either a URL or search config
    const syncableSources = sources.filter((s) => {
      const config = s.config as any;
      return config.url || config.urls?.length || config.searchTerm || config.searchTerms?.length;
    });
    if (syncableSources.length === 0) {
      res.json({ results: [], totalNewJobs: 0, totalErrors: 0 });
      return;
    }
    const results: any[] = [];
    for (const source of syncableSources) {
      results.push(await syncSource(source, ctx));
    }
    res.json({
      results,
      totalNewJobs: results.reduce((s, r) => s + r.newJobs, 0),
      totalErrors: results.reduce((s, r) => s + r.errors.length, 0),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
