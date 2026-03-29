import Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import {
  candidates,
  experienceBlocks,
  jobs,
  jobScores,
  llmRuns,
  preferences,
  projects,
  resumes,
  skills,
  tailoredResumes,
} from '@job-pilot/db/schema';
import {
  JOB_PARSER_PROMPT as _JOB_PARSER_PROMPT,
  RESUME_PARSER_PROMPT as _RESUME_PARSER_PROMPT,
  RESUME_TAILORING_PROMPT as _RESUME_TAILORING_PROMPT,
  SCORING_PROMPT as _SCORING_PROMPT,
  RESUME_PARSER_PDF_INSTRUCTION,
} from '@job-pilot/mastra/prompts';
import { cacheDelete, cacheDeletePattern } from '../lib/cache.js';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { getDownloadUrl } from '../lib/s3.js';

const MODEL = 'claude-sonnet-4-20250514';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

export async function getClient(): Promise<Anthropic> {
  const { getDecryptedApiKey } = await import('./settings.js');
  const apiKey = await getDecryptedApiKey('anthropic');
  if (!apiKey)
    throw new Error(
      'ANTHROPIC_API_KEY not configured. Add it to your .env file or set it in Settings.',
    );
  return new Anthropic({ apiKey });
}

function htmlToText(html: string): string {
  return (
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Preserve link URLs before stripping tags
      .replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  );
}

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate)
    throw new Error('No candidate profile found. Create one before using AI features.');
  return candidate;
}

export async function loadCandidateProfile(candidateId: string) {
  const [candidate, candidateSkills, experience, candidatePreferences] = await Promise.all([
    db.query.candidates.findFirst({ where: eq(candidates.id, candidateId) }),
    db.query.skills.findMany({ where: eq(skills.candidateId, candidateId) }),
    db.query.experienceBlocks.findMany({
      where: eq(experienceBlocks.candidateId, candidateId),
      orderBy: [desc(experienceBlocks.startDate)],
    }),
    db.query.preferences.findMany({ where: eq(preferences.candidateId, candidateId) }),
  ]);
  if (!candidate) throw new Error('Candidate not found');
  return { ...candidate, skills: candidateSkills, experience, preferences: candidatePreferences };
}

export function parseJsonResponse<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned) as T;
}

export async function recordLLMRun(params: {
  tenantId: string;
  candidateId?: string;
  jobId?: string;
  purpose: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}) {
  try {
    await db.insert(llmRuns).values({
      id: createId(),
      tenantId: params.tenantId,
      provider: 'anthropic',
      model: params.model,
      purpose: params.purpose,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      latencyMs: params.latencyMs,
    });
  } catch (err) {
    console.error('Failed to record LLM run:', err);
  }
}

// Prompts imported from @job-pilot/mastra/prompts (single source of truth)
const JOB_PARSER_PROMPT = _JOB_PARSER_PROMPT;
const SCORING_PROMPT = _SCORING_PROMPT;
const RESUME_PARSER_PROMPT = _RESUME_PARSER_PROMPT;
const RESUME_TAILORING_PROMPT = _RESUME_TAILORING_PROMPT;

async function callParseLLM(rawText: string, auditCtx?: { tenantId: string; jobId?: string }) {
  const client = await getClient();
  const startTime = Date.now();
  let success = false;
  let errorMsg: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: JOB_PARSER_PROMPT,
      messages: [{ role: 'user', content: rawText }],
    });
    inputTokens = message.usage?.input_tokens ?? 0;
    outputTokens = message.usage?.output_tokens ?? 0;
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const result = parseJsonResponse<any>(responseText);
    success = true;
    return result;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    if (auditCtx)
      await recordLLMRun({
        tenantId: auditCtx.tenantId,
        jobId: auditCtx.jobId,
        purpose: 'parse_job_description',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
        success,
        error: errorMsg,
      });
  }
}

async function callScoreLLM(job: any, profile: any, auditCtx?: any) {
  const client = await getClient();
  const startTime = Date.now();
  let success = false;
  let errorMsg: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  const userContent = `## JOB\n${JSON.stringify({ title: job.title, company: job.company, location: job.location, remotePolicy: job.remotePolicy, compensationMin: job.compensationMin, compensationMax: job.compensationMax, mustHaveSkills: job.mustHaveSkills, niceToHaveSkills: job.niceToHaveSkills, domain: job.domain, description: (job.rawDescription || '').slice(0, 3000) }, null, 2)}\n\n## CANDIDATE\n${JSON.stringify({ currentTitle: profile.currentTitle, currentCompany: profile.currentCompany, yearsOfExperience: profile.yearsOfExperience, location: profile.location, remotePreference: profile.remotePreference, salaryMin: profile.salaryMin, salaryMax: profile.salaryMax, visaRequired: profile.visaRequired, avoidedCompanies: profile.avoidedCompanies, skills: profile.skills.map((s: any) => ({ name: s.name, category: s.category, confidenceScore: s.confidenceScore })), experience: profile.experience.map((e: any) => ({ company: e.company, title: e.title, description: e.description, skills: e.skills })), preferences: profile.preferences.map((p: any) => ({ key: p.key, value: p.value, category: p.category })) }, null, 2)}`;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SCORING_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    inputTokens = message.usage?.input_tokens ?? 0;
    outputTokens = message.usage?.output_tokens ?? 0;
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const result = parseJsonResponse<any>(responseText);
    success = true;
    return result;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    if (auditCtx)
      await recordLLMRun({
        ...auditCtx,
        purpose: 'score_job',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
        success,
        error: errorMsg,
      });
  }
}

async function scoreJobInternal(jobId: string, ctx: { tenantId: string; userId: string }) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.tenantId, ctx.tenantId)),
  });
  if (!job) throw new Error('Job not found');
  const candidate = await getCurrentCandidate(ctx);
  const profile = await loadCandidateProfile(candidate.id);
  const result = await callScoreLLM(job, profile, {
    tenantId: ctx.tenantId,
    candidateId: candidate.id,
    jobId,
  });
  await db
    .delete(jobScores)
    .where(and(eq(jobScores.jobId, jobId), eq(jobScores.candidateId, candidate.id)));
  const [score] = await db
    .insert(jobScores)
    .values({
      id: createId(),
      jobId,
      candidateId: candidate.id,
      fitScore: result.fitScore,
      competitivenessScore: result.competitivenessScore,
      overallScore: result.overallScore,
      fitBreakdown: result.fitBreakdown,
      competitivenessBreakdown: result.competitivenessBreakdown,
      recommendation: result.recommendation,
      reasoning: result.reasoning,
      scoredAt: new Date(),
    })
    .returning();
  await cacheDeletePattern(`dashboard:${ctx.tenantId}`);
  return score;
}

/** Fetch page content via Firecrawl API (returns markdown). */
async function fetchWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url, formats: ['markdown'] }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Firecrawl API error: ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 200)}` : ''}`,
      );
    }
    const data = await response.json();
    const markdown = data?.data?.markdown;
    if (!markdown || markdown.length < 50)
      throw new Error('Firecrawl returned insufficient content for this URL.');
    return markdown;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch page content via direct HTTP (returns plain text from HTML). */
async function fetchDirect(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok)
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    const rawHtml = await response.text();
    return htmlToText(rawHtml);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Detect if a URL points to a search results page and extract individual job URLs.
 */
async function extractJobUrlsFromPage(
  url: string,
  rawText: string,
  auditCtx?: { tenantId: string },
): Promise<string[]> {
  const searchPagePatterns = [
    /linkedin\.com\/jobs\/search/i,
    /linkedin\.com\/jobs\/collection/i,
    /indeed\.com\/jobs\?/i,
    /indeed\.com\/q-/i,
    /glassdoor\.com\/Job\/.*jobs/i,
    /ziprecruiter\.com\/jobs\/search/i,
    /usajobs\.gov\/search/i,
    /greenhouse\.io\/.*\/jobs/i,
    /lever\.co\//i,
    /careers\./i,
    /\/jobs\/?(\?|$)/i,
    /\/careers\/?(\?|$)/i,
    /\/openings\/?(\?|$)/i,
  ];
  if (!searchPagePatterns.some((p) => p.test(url))) return [];

  const client = await getClient();
  const startTime = Date.now();
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: `You are a job URL extractor. Given the text content of a job search results page, extract all individual job posting URLs.
Rules:
- Return ONLY a JSON object: { "jobUrls": ["url1", "url2", ...], "isSearchPage": true }
- Extract FULL absolute URLs for individual job postings (not search/filter pages)
- For LinkedIn: look for /jobs/view/ URLs
- For Indeed: look for /viewjob or /rc/clk URLs
- For Greenhouse: look for /jobs/ URLs with numeric IDs
- If no job URLs found or NOT a search results page, return { "jobUrls": [], "isSearchPage": false }
- Maximum 25 URLs per page`,
      messages: [
        {
          role: 'user',
          content: `URL: ${url}\n\nPage content (first 8000 chars):\n${rawText.slice(0, 8000)}`,
        },
      ],
    });
    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    if (auditCtx)
      await recordLLMRun({
        tenantId: auditCtx.tenantId,
        purpose: 'extract_job_urls',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
        success: true,
      });
    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const result = parseJsonResponse<{ jobUrls: string[]; isSearchPage: boolean }>(responseText);
    if (!result.isSearchPage || !result.jobUrls?.length) return [];
    return result.jobUrls.filter((u) => u.startsWith('http')).slice(0, 25);
  } catch {
    return [];
  }
}

// Blocklist of known job board homepages that should never be scraped
const HOMEPAGE_PATTERNS = [
  /^https?:\/\/(www\.)?adzuna\.com\/?$/i,
  /^https?:\/\/(www\.)?indeed\.com\/?$/i,
  /^https?:\/\/(www\.)?linkedin\.com\/jobs\/?$/i,
  /^https?:\/\/(www\.)?glassdoor\.com\/(Job|index)\/?$/i,
  /^https?:\/\/(www\.)?ziprecruiter\.com\/?$/i,
  /^https?:\/\/(www\.)?simplyhired\.com\/?$/i,
  /^https?:\/\/(www\.)?dice\.com\/?$/i,
  /^https?:\/\/(www\.)?hired\.com\/?$/i,
  /^https?:\/\/(www\.)?flexjobs\.com\/?$/i,
  /^https?:\/\/(www\.)?usajobs\.gov\/?$/i,
  /^https?:\/\/(www\.)?remoteok\.com\/?$/i,
  /^https?:\/\/(www\.)?weworkremotely\.com\/?$/i,
];

/** Check if a string looks like garbage (empty, HTML tags only, or a placeholder like "Unknown") */
function isGarbageText(text: string | undefined | null): boolean {
  if (!text) return true;
  const cleaned = text.replace(/<[^>]*>/g, '').trim();
  if (cleaned.length < 2) return true;
  if (/^(unknown|n\/a|none|null|undefined|untitled|no\s*title|no\s*company)$/i.test(cleaned))
    return true;
  return false;
}

export async function ingestJobFromUrlInternal(
  url: string,
  ctx: { tenantId: string; userId: string },
) {
  // 1. Deduplicate by URL first (fast check before expensive fetch+parse)
  const existingByUrl = await db.query.jobs.findFirst({
    where: and(eq(jobs.tenantId, ctx.tenantId), eq(jobs.sourceUrl, url)),
  });
  if (existingByUrl) {
    const existingScore = await db.query.jobScores.findFirst({
      where: eq(jobScores.jobId, existingByUrl.id),
    });
    return { ...existingByUrl, score: existingScore ?? null, deduplicated: true };
  }

  // 1b. Block known job board homepages before expensive fetch+parse
  if (HOMEPAGE_PATTERNS.some((pattern) => pattern.test(url))) {
    throw new Error(
      `"${url}" is a job board homepage, not a job posting. Use the search-powered sources on the Jobs page to find jobs from this board.`,
    );
  }

  // 2. Fetch the URL — try Firecrawl first (handles anti-bot), fall back to direct
  let rawText: string;
  const { getDecryptedApiKey } = await import('./settings.js');
  const firecrawlKey = await getDecryptedApiKey('firecrawl').catch(() => null);

  if (firecrawlKey) {
    try {
      rawText = await fetchWithFirecrawl(url, firecrawlKey);
    } catch (firecrawlErr) {
      try {
        rawText = await fetchDirect(url);
      } catch {
        throw firecrawlErr;
      }
    }
  } else {
    rawText = await fetchDirect(url);
  }

  if (rawText.length < 50) throw new Error('Page content too short to be a valid job posting.');

  // 3. Check if this is a search results page with multiple jobs
  const jobUrls = await extractJobUrlsFromPage(url, rawText, { tenantId: ctx.tenantId });
  if (jobUrls.length > 0) {
    const results: any[] = [];
    for (const jobUrl of jobUrls) {
      try {
        results.push(await ingestJobFromUrlInternal(jobUrl, ctx));
      } catch {
        /* skip */
      }
    }
    return {
      isSearchPage: true,
      jobsExtracted: results.length,
      jobs: results,
      deduplicated: false,
    };
  }

  // 4. Parse with Claude (single job posting)
  const parsed = await callParseLLM(rawText, { tenantId: ctx.tenantId });

  // 4b. Validate parsed results — reject garbage scrapes
  const linkCount = (rawText.match(/<a\s|href=/gi) || []).length;
  if (linkCount > 50) {
    throw new Error(
      'This URL appears to be a homepage or search page, not an individual job posting. Try adding a specific job listing URL instead, or use the search-powered sources (LinkedIn, Indeed, Adzuna, Google Jobs) from the Jobs page.',
    );
  }
  // For single-object results, validate company/title; arrays are validated per-position below
  if (!Array.isArray(parsed)) {
    if (isGarbageText(parsed.company)) {
      throw new Error(
        'This URL appears to be a homepage or search page, not an individual job posting. Try adding a specific job listing URL instead, or use the search-powered sources (LinkedIn, Indeed, Adzuna, Google Jobs) from the Jobs page.',
      );
    }
    if (isGarbageText(parsed.title)) {
      throw new Error(
        'This URL appears to be a homepage or search page, not an individual job posting. Try adding a specific job listing URL instead, or use the search-powered sources (LinkedIn, Indeed, Adzuna, Google Jobs) from the Jobs page.',
      );
    }
  }

  // 4c. Handle multi-position postings — create separate job records
  if (Array.isArray(parsed)) {
    const results: any[] = [];
    for (const position of parsed) {
      if (isGarbageText(position.company) || isGarbageText(position.title)) continue;
      // Deduplicate by content
      const existing = await db.query.jobs.findFirst({
        where: and(
          eq(jobs.tenantId, ctx.tenantId),
          eq(jobs.company, position.company),
          eq(jobs.title, position.title),
          eq(jobs.location, position.location || ''),
        ),
      });
      if (existing) {
        const existingScore = await db.query.jobScores.findFirst({
          where: eq(jobScores.jobId, existing.id),
        });
        results.push({ ...existing, score: existingScore ?? null, deduplicated: true });
        continue;
      }
      const jobId = createId();
      const resolvedApplyUrl =
        position.applyUrl && position.applyUrl.startsWith('http') ? position.applyUrl : url;
      const [job] = await db
        .insert(jobs)
        .values({
          id: jobId,
          tenantId: ctx.tenantId,
          company: position.company,
          title: position.title,
          location: position.location || '',
          remotePolicy: position.remotePolicy || 'unknown',
          compensationMin: position.compensationMin ?? null,
          compensationMax: position.compensationMax ?? null,
          compensationCurrency: position.compensationCurrency || null,
          compensationType: position.compensationType || null,
          employmentType: position.employmentType || 'full_time',
          yearsRequired: position.yearsRequired ?? null,
          mustHaveSkills: position.mustHaveSkills || [],
          niceToHaveSkills: position.niceToHaveSkills || [],
          domain: position.domain || null,
          sponsorship: position.sponsorship || 'unknown',
          applyUrl: resolvedApplyUrl,
          sourceUrl: url,
          rawDescription: rawText,
          parsedDescription: position.description || '',
        })
        .returning();
      let score = null;
      try {
        score = await scoreJobInternal(jobId, ctx);
      } catch {
        /* best-effort */
      }
      results.push({ ...job, score, deduplicated: false });
    }
    return { isMultiPosition: true, positions: results.length, jobs: results };
  }

  // 5. Deduplicate by content (company + title + location)
  const existing = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.tenantId, ctx.tenantId),
      eq(jobs.company, parsed.company),
      eq(jobs.title, parsed.title),
      eq(jobs.location, parsed.location),
    ),
  });
  if (existing) {
    const existingScore = await db.query.jobScores.findFirst({
      where: eq(jobScores.jobId, existing.id),
    });
    return { ...existing, score: existingScore ?? null, deduplicated: true };
  }

  // 6. Save to DB — use parsed applyUrl if available, otherwise fall back to input URL
  const jobId = createId();
  const resolvedApplyUrl =
    parsed.applyUrl && parsed.applyUrl.startsWith('http') ? parsed.applyUrl : url;
  const [job] = await db
    .insert(jobs)
    .values({
      id: jobId,
      tenantId: ctx.tenantId,
      company: parsed.company,
      title: parsed.title,
      location: parsed.location,
      remotePolicy: parsed.remotePolicy,
      compensationMin: parsed.compensationMin,
      compensationMax: parsed.compensationMax,
      compensationCurrency: parsed.compensationCurrency,
      compensationType: parsed.compensationType,
      employmentType: parsed.employmentType,
      yearsRequired: parsed.yearsRequired,
      mustHaveSkills: parsed.mustHaveSkills,
      niceToHaveSkills: parsed.niceToHaveSkills,
      domain: parsed.domain,
      sponsorship: parsed.sponsorship,
      applyUrl: resolvedApplyUrl,
      sourceUrl: url,
      rawDescription: rawText,
      parsedDescription: parsed.description,
    })
    .returning();

  // 7. Auto-score
  let score = null;
  try {
    score = await scoreJobInternal(jobId, ctx);
  } catch {
    /* best-effort */
  }
  return { ...job, score, deduplicated: false };
}

const router = Router();

router.post('/ingest-url', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`ingestJobFromUrl:${ctx.tenantId}`, 10);
    const result = await ingestJobFromUrlInternal(req.body.url, ctx);
    capture(ctx.userId, 'job_ingested_from_url', {
      tenantId: ctx.tenantId,
      url: req.body.url,
      jobId: 'id' in result ? result.id : undefined,
    });
    res.json(result);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'job_ingested_from_url', e, {
        tenantId: ctx.tenantId,
        url: req.body.url,
      });
    } catch {}
    next(e);
  }
});

router.post('/parse-description', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    if (!req.body.text || req.body.text.trim().length < 50)
      throw new Error('Job description text is too short.');
    res.json(await callParseLLM(req.body.text.trim(), { tenantId: ctx.tenantId }));
  } catch (e) {
    next(e);
  }
});

router.post('/ingest-text', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`ingestJobFromUrl:${ctx.tenantId}`, 10);
    const rawText = (req.body.text || '').trim();
    if (rawText.length < 50)
      throw new Error('Job description text is too short. Provide at least 50 characters.');
    const parsed = await callParseLLM(rawText, { tenantId: ctx.tenantId });
    const existing = await db.query.jobs.findFirst({
      where: and(
        eq(jobs.tenantId, ctx.tenantId),
        eq(jobs.company, parsed.company),
        eq(jobs.title, parsed.title),
        eq(jobs.location, parsed.location),
      ),
    });
    if (existing) {
      const existingScore = await db.query.jobScores.findFirst({
        where: eq(jobScores.jobId, existing.id),
      });
      res.json({ ...existing, score: existingScore ?? null, deduplicated: true });
      return;
    }
    const jobId = createId();
    const applyUrl = parsed.applyUrl && parsed.applyUrl.startsWith('http') ? parsed.applyUrl : '';
    const sourceLabel = req.body.sourceLabel || 'manual';
    const [job] = await db
      .insert(jobs)
      .values({
        id: jobId,
        tenantId: ctx.tenantId,
        company: parsed.company,
        title: parsed.title,
        location: parsed.location,
        remotePolicy: parsed.remotePolicy,
        compensationMin: parsed.compensationMin,
        compensationMax: parsed.compensationMax,
        compensationCurrency: parsed.compensationCurrency,
        compensationType: parsed.compensationType,
        employmentType: parsed.employmentType,
        yearsRequired: parsed.yearsRequired,
        mustHaveSkills: parsed.mustHaveSkills,
        niceToHaveSkills: parsed.niceToHaveSkills,
        domain: parsed.domain,
        sponsorship: parsed.sponsorship,
        applyUrl: applyUrl || `pasted:${sourceLabel}`,
        sourceUrl: `pasted:${sourceLabel}:${Date.now()}`,
        rawDescription: rawText,
        parsedDescription: parsed.description,
      })
      .returning();
    let score = null;
    try {
      score = await scoreJobInternal(jobId, ctx);
    } catch {
      /* best-effort */
    }
    capture(ctx.userId, 'job_ingested_from_text', { tenantId: ctx.tenantId, jobId: job.id });
    res.json({ ...job, score, deduplicated: false });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'job_ingested_from_text', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/score-job', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`scoreJob:${ctx.tenantId}`, 20);
    const result = await scoreJobInternal(req.body.jobId, ctx);
    capture(ctx.userId, 'job_scored', {
      tenantId: ctx.tenantId,
      jobId: req.body.jobId,
      fitScore: result.fitScore,
      competitivenessScore: result.competitivenessScore,
    });
    res.json(result);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'job_scored', e, { tenantId: ctx.tenantId, jobId: req.body.jobId });
    } catch {}
    next(e);
  }
});

router.post('/rescore-all', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`rescoreAllJobs:${ctx.tenantId}`, 2);
    const allJobs = await db.query.jobs.findMany({
      where: eq(jobs.tenantId, ctx.tenantId),
      orderBy: [desc(jobs.createdAt)],
    });
    if (allJobs.length === 0) {
      res.json({ count: 0 });
      return;
    }
    await getCurrentCandidate(ctx);
    let scoredCount = 0;
    const errors: any[] = [];
    for (const job of allJobs) {
      try {
        await scoreJobInternal(job.id, ctx);
        scoredCount++;
      } catch (err) {
        errors.push({ jobId: job.id, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }
    capture(ctx.userId, 'all_jobs_rescored', {
      tenantId: ctx.tenantId,
      count: scoredCount,
    });
    res.json({
      count: scoredCount,
      total: allJobs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'all_jobs_rescored', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/parse-resume', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`parseResume:${ctx.tenantId}`, 10);
    const candidate = await getCurrentCandidate(ctx);
    const resume = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, req.body.resumeId),
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });
    if (!resume) throw new Error('Resume not found');
    const downloadUrl = await getDownloadUrl(resume.storageKey);
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Failed to download resume file: ${response.status}`);

    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let success = false;
    let errorMsg: string | undefined;

    // Determine file type from storage key
    const isPdf = resume.storageKey.toLowerCase().endsWith('.pdf');
    const isDocx = resume.storageKey.toLowerCase().endsWith('.docx');

    let messageContent: Anthropic.MessageParam['content'];

    if (isPdf) {
      // Send PDF as base64 document to Claude's vision API for accurate parsing
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      if (base64.length < 100) throw new Error('Resume file appears to be empty.');
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        },
        {
          type: 'text',
          text: 'Parse this resume document. Extract all information accurately. Do NOT fabricate or assume any information that is not explicitly stated in the document. If a field cannot be determined from the document, use null or an empty string.',
        },
      ];
    } else {
      // Text-based files (txt, docx fallback) — read as text
      const fileContent = await response.text();
      if (!fileContent || fileContent.trim().length < 20)
        throw new Error('Resume file appears to be empty.');
      messageContent = `Parse this resume:\n\n${fileContent.trim()}`;
    }

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: RESUME_PARSER_PROMPT,
        messages: [{ role: 'user', content: messageContent }],
      });
      inputTokens = message.usage?.input_tokens ?? 0;
      outputTokens = message.usage?.output_tokens ?? 0;
      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      const parsed = parseJsonResponse<any>(responseText);
      success = true;
      await db
        .update(resumes)
        .set({ parsedContent: parsed, updatedAt: new Date() })
        .where(eq(resumes.id, resume.id));
      capture(ctx.userId, 'resume_parsed', { tenantId: ctx.tenantId, resumeId: req.body.resumeId });
      res.json(parsed);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      captureError(ctx.userId, 'resume_parsed', err, { tenantId: ctx.tenantId });
      throw err;
    } finally {
      await recordLLMRun({
        tenantId: ctx.tenantId,
        candidateId: candidate.id,
        purpose: 'parse_resume',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
        success,
        error: errorMsg,
      });
    }
  } catch (e) {
    next(e);
  }
});

router.post('/apply-parsed-resume', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`applyParsedResume:${ctx.tenantId}`, 10);
    const candidate = await getCurrentCandidate(ctx);
    const resume = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, req.body.resumeId),
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });
    if (!resume) throw new Error('Resume not found');
    const parsed = req.body.parsedData;
    await db
      .update(candidates)
      .set({
        headline: parsed.headline || candidate.headline,
        summary: parsed.summary || candidate.summary,
        yearsOfExperience: parsed.yearsOfExperience ?? candidate.yearsOfExperience,
        currentTitle: parsed.currentTitle || candidate.currentTitle,
        currentCompany: parsed.currentCompany ?? candidate.currentCompany,
        location: parsed.location || candidate.location,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidate.id));
    if (parsed.skills?.length > 0)
      await db.insert(skills).values(
        parsed.skills.map((s: any) => ({
          candidateId: candidate.id,
          name: s.name,
          category: s.category,
          confidenceScore: s.confidenceScore ?? 50,
          yearsUsed: s.yearsUsed,
        })),
      );
    if (parsed.experience?.length > 0)
      await db.insert(experienceBlocks).values(
        parsed.experience.map((exp: any) => ({
          candidateId: candidate.id,
          company: exp.company,
          title: exp.title,
          location: exp.location || '',
          startDate: new Date(exp.startDate),
          endDate: exp.endDate ? new Date(exp.endDate) : undefined,
          current: exp.current ?? false,
          description: exp.description || '',
          bullets: exp.bullets ?? [],
          skills: exp.skills ?? [],
        })),
      );
    if (parsed.projects?.length > 0)
      await db.insert(projects).values(
        parsed.projects.map((proj: any) => ({
          candidateId: candidate.id,
          name: proj.name,
          description: proj.description || '',
          url: proj.url,
          skills: proj.skills ?? [],
          highlights: proj.highlights ?? [],
        })),
      );
    await cacheDelete(`candidate:${ctx.tenantId}:${ctx.userId}`);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/tailor-resume', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`tailorResume:${ctx.tenantId}`, 5);
    const candidate = await getCurrentCandidate(ctx);
    const profile = await loadCandidateProfile(candidate.id);
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, req.body.jobId), eq(jobs.tenantId, ctx.tenantId)),
    });
    if (!job) throw new Error('Job not found');
    const existingScore = await db.query.jobScores.findFirst({
      where: and(eq(jobScores.jobId, req.body.jobId), eq(jobScores.candidateId, candidate.id)),
    });
    const scoreData = existingScore
      ? {
          overallScore: existingScore.overallScore,
          recommendation: existingScore.recommendation,
          reasoning: existingScore.reasoning,
        }
      : null;
    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    const userContent = `## JOB\n${JSON.stringify({ title: job.title, company: job.company, location: job.location, mustHaveSkills: job.mustHaveSkills, niceToHaveSkills: job.niceToHaveSkills, description: (job.rawDescription || '').slice(0, 3000) }, null, 2)}\n\n## CANDIDATE\n${JSON.stringify({ currentTitle: profile.currentTitle, headline: profile.headline, summary: profile.summary, skills: profile.skills.map((s: any) => ({ name: s.name, category: s.category })), experience: profile.experience.map((e: any) => ({ company: e.company, title: e.title, startDate: e.startDate, endDate: e.endDate, current: e.current, description: e.description, bullets: e.bullets, skills: e.skills })) }, null, 2)}${scoreData ? `\n\n## SCORE\n${JSON.stringify(scoreData, null, 2)}` : ''}\n\nGenerate a tailored resume.`;
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: RESUME_TAILORING_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    inputTokens = message.usage?.input_tokens ?? 0;
    outputTokens = message.usage?.output_tokens ?? 0;
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const tailoredContent = parseJsonResponse<any>(responseText);
    await recordLLMRun({
      tenantId: ctx.tenantId,
      candidateId: candidate.id,
      jobId: req.body.jobId,
      purpose: 'tailor_resume',
      model: MODEL,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      success: true,
    });
    const existingTailored = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, req.body.jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });
    const nextVersion = existingTailored ? existingTailored.version + 1 : 1;
    const tailoredId = createId();
    const [saved] = await db
      .insert(tailoredResumes)
      .values({
        id: tailoredId,
        candidateId: candidate.id,
        jobId: req.body.jobId,
        tenantId: ctx.tenantId,
        storageKey: `tailored/${ctx.tenantId}/${req.body.jobId}/${tailoredId}.json`,
        contentJson: tailoredContent,
        version: nextVersion,
      })
      .returning();
    capture(ctx.userId, 'resume_tailored', { tenantId: ctx.tenantId, jobId: req.body.jobId });
    res.json({ ...saved, content: tailoredContent });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'resume_tailored', e, {
        tenantId: ctx.tenantId,
        jobId: req.body.jobId,
      });
    } catch {}
    next(e);
  }
});

router.get('/tailored-resume', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId } = req.query as { jobId: string };
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.json(null);
      return;
    }
    const tailored = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });
    if (!tailored) {
      res.json(null);
      return;
    }
    res.json({ ...tailored, content: tailored.contentJson });
  } catch (e) {
    next(e);
  }
});

router.get('/resume-library', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.json([]);
      return;
    }

    const allTailored = await db.query.tailoredResumes.findMany({
      where: and(
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.createdAt)],
    });

    // Enrich with job info
    const jobIds = [...new Set(allTailored.map((t) => t.jobId))];
    const jobList =
      jobIds.length > 0
        ? await db.query.jobs
            .findMany({
              where: and(eq(jobs.tenantId, ctx.tenantId)),
              columns: { id: true, title: true, company: true },
            })
            .then((all) => all.filter((j) => jobIds.includes(j.id)))
        : [];
    const jobMap = Object.fromEntries(jobList.map((j) => [j.id, j]));

    const enriched = allTailored.map((t) => ({
      id: t.id,
      jobId: t.jobId,
      jobTitle: jobMap[t.jobId]?.title ?? 'Unknown Job',
      jobCompany: jobMap[t.jobId]?.company ?? 'Unknown',
      version: t.version,
      createdAt: t.createdAt,
      // Include a preview of the content (summary + skill count)
      summary: (t.contentJson as any)?.summary?.slice(0, 150) ?? '',
      skillCount: (t.contentJson as any)?.highlightedSkills?.length ?? 0,
    }));

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

router.get('/original-profile', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.json(null);
      return;
    }
    const [candidateSkills, experience, candidateProjects] = await Promise.all([
      db.query.skills.findMany({ where: eq(skills.candidateId, candidate.id) }),
      db.query.experienceBlocks.findMany({
        where: eq(experienceBlocks.candidateId, candidate.id),
        orderBy: [desc(experienceBlocks.startDate)],
      }),
      db.query.projects.findMany({ where: eq(projects.candidateId, candidate.id) }),
    ]);
    res.json({
      summary: candidate.summary,
      headline: candidate.headline,
      currentTitle: candidate.currentTitle,
      currentCompany: candidate.currentCompany,
      yearsOfExperience: candidate.yearsOfExperience,
      skills: candidateSkills.map((s) => ({
        name: s.name,
        category: s.category,
        confidenceScore: s.confidenceScore,
        yearsUsed: s.yearsUsed,
      })),
      experience: experience.map((e) => ({
        company: e.company,
        title: e.title,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        current: e.current,
        description: e.description,
        bullets: e.bullets as string[],
        skills: e.skills as string[],
      })),
      projects: candidateProjects.map((p) => ({
        name: p.name,
        description: p.description,
        url: p.url,
        skills: p.skills as string[],
        highlights: p.highlights as string[],
      })),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
