import Anthropic from '@anthropic-ai/sdk';
import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, sql } from 'drizzle-orm';
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
  JOB_PARSER_PROMPT,
  RESUME_PARSER_PDF_INSTRUCTION,
  RESUME_PARSER_PROMPT,
  RESUME_TAILORING_PROMPT,
  SCORING_PROMPT,
} from '@job-pilot/mastra/prompts';
import { getTenantContext } from '~/lib/api';
import { checkRateLimit } from '~/lib/rate-limit';
import { getDownloadUrl } from '~/lib/s3';
import { getDecryptedApiKey } from './settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-20250514';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

export async function getClient(): Promise<Anthropic> {
  const apiKey = await getDecryptedApiKey('anthropic');
  if (!apiKey)
    throw new Error(
      'ANTHROPIC_API_KEY not configured. Add it to your .env file or set it in Settings.',
    );
  return new Anthropic({ apiKey });
}

/** Strip HTML tags and collapse whitespace to produce plain text. */
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

/** Get the candidate profile for the currently authenticated user. */
async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate)
    throw new Error('No candidate profile found. Create one before using AI features.');
  return candidate;
}

/** Load the full candidate profile including skills, experience, and preferences. */
async function loadCandidateProfile(candidateId: string) {
  const [candidate, candidateSkills, experience, candidatePreferences] = await Promise.all([
    db.query.candidates.findFirst({
      where: eq(candidates.id, candidateId),
    }),
    db.query.skills.findMany({
      where: eq(skills.candidateId, candidateId),
    }),
    db.query.experienceBlocks.findMany({
      where: eq(experienceBlocks.candidateId, candidateId),
      orderBy: [desc(experienceBlocks.startDate)],
    }),
    db.query.preferences.findMany({
      where: eq(preferences.candidateId, candidateId),
    }),
  ]);

  if (!candidate) throw new Error('Candidate not found');

  return {
    ...candidate,
    skills: candidateSkills,
    experience,
    preferences: candidatePreferences,
  };
}

/** Parse Claude's response text as JSON, handling potential markdown fences. */
function parseJsonResponse<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned) as T;
}

// ---------------------------------------------------------------------------
// LLM Audit Logging
// ---------------------------------------------------------------------------

async function recordLLMRun(params: {
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
    // Don't throw - audit logging should not break the main flow
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedResume {
  headline: string;
  summary: string;
  yearsOfExperience: number;
  currentTitle: string;
  currentCompany: string | null;
  location: string;
  skills: Array<{
    name: string;
    category: string;
    confidenceScore: number;
    yearsUsed: number | null;
  }>;
  experience: Array<{
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string | null;
    current: boolean;
    description: string;
    bullets: string[];
    skills: string[];
  }>;
  projects: Array<{
    name: string;
    description: string;
    url: string | null;
    skills: string[];
    highlights: string[];
  }>;
}

interface ParsedJob {
  company: string;
  title: string;
  location: string;
  remotePolicy: string;
  compensationMin: number | null;
  compensationMax: number | null;
  compensationCurrency: string | null;
  compensationType: string;
  employmentType: string;
  yearsRequired: number | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  domain: string | null;
  sponsorship: string;
  description: string;
}

interface ScoreResult {
  fitScore: number;
  fitBreakdown: {
    titleMatch: number;
    compensationFit: number;
    locationFit: number;
    stackOverlap: number;
    seniorityFit: number;
    industryFit: number;
  };
  competitivenessScore: number;
  competitivenessBreakdown: {
    requiredSkillsOverlap: number;
    experienceDepth: number;
    domainRelevance: number;
    leadershipMatch: number;
    adjacentSkills: number;
    gapPenalty: number;
  };
  overallScore: number;
  recommendation: string;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Internal (non-exported) helpers that do the actual AI work
// ---------------------------------------------------------------------------

/** Call Claude to parse a job description from raw text. */
async function callParseLLM(
  rawText: string,
  auditCtx?: { tenantId: string; jobId?: string },
): Promise<ParsedJob> {
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

    const result = parseJsonResponse<ParsedJob>(responseText);
    success = true;
    return result;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    const latencyMs = Date.now() - startTime;
    if (auditCtx) {
      await recordLLMRun({
        tenantId: auditCtx.tenantId,
        jobId: auditCtx.jobId,
        purpose: 'parse_job_description',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMsg,
      });
    }
  }
}

/** Call Claude to score a job against a candidate profile. */
async function callScoreLLM(
  job: {
    title: string;
    company: string;
    location: string;
    remotePolicy: string;
    compensationMin: number | null;
    compensationMax: number | null;
    compensationType: string;
    employmentType: string;
    yearsRequired: number | null;
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    domain: string | null;
    rawDescription: string;
  },
  profile: Awaited<ReturnType<typeof loadCandidateProfile>>,
  auditCtx?: { tenantId: string; candidateId?: string; jobId?: string },
): Promise<ScoreResult> {
  const client = await getClient();
  const startTime = Date.now();
  let success = false;
  let errorMsg: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  const userContent = `## JOB
${JSON.stringify(
  {
    title: job.title,
    company: job.company,
    location: job.location,
    remotePolicy: job.remotePolicy,
    compensationMin: job.compensationMin,
    compensationMax: job.compensationMax,
    compensationType: job.compensationType,
    employmentType: job.employmentType,
    yearsRequired: job.yearsRequired,
    mustHaveSkills: job.mustHaveSkills,
    niceToHaveSkills: job.niceToHaveSkills,
    domain: job.domain,
    description: job.rawDescription.slice(0, 3000),
  },
  null,
  2,
)}

## CANDIDATE
${JSON.stringify(
  {
    currentTitle: profile.currentTitle,
    currentCompany: profile.currentCompany,
    yearsOfExperience: profile.yearsOfExperience,
    location: profile.location,
    remotePreference: profile.remotePreference,
    salaryMin: profile.salaryMin,
    salaryMax: profile.salaryMax,
    salaryCurrency: profile.salaryCurrency,
    visaRequired: profile.visaRequired,
    skills: profile.skills.map((s) => ({
      name: s.name,
      category: s.category,
      confidenceScore: s.confidenceScore,
      yearsUsed: s.yearsUsed,
    })),
    experience: profile.experience.map((e) => ({
      company: e.company,
      title: e.title,
      description: e.description,
      skills: e.skills,
      current: e.current,
    })),
    preferences: profile.preferences.map((p) => ({
      key: p.key,
      value: p.value,
      category: p.category,
    })),
  },
  null,
  2,
)}`;

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

    const result = parseJsonResponse<ScoreResult>(responseText);
    success = true;
    return result;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    const latencyMs = Date.now() - startTime;
    if (auditCtx) {
      await recordLLMRun({
        tenantId: auditCtx.tenantId,
        candidateId: auditCtx.candidateId,
        jobId: auditCtx.jobId,
        purpose: 'score_job',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMsg,
      });
    }
  }
}

/** Internal scoring logic shared by scoreJob and rescoreAllJobs. */
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
    jobId: jobId,
  });

  // Upsert: delete any existing score for this job+candidate, then insert fresh
  await db
    .delete(jobScores)
    .where(and(eq(jobScores.jobId, jobId), eq(jobScores.candidateId, candidate.id)));

  const scoreId = createId();
  const [score] = await db
    .insert(jobScores)
    .values({
      id: scoreId,
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

  // Invalidate dashboard cache since scores feed into stats & activity
  const { cacheDeletePattern } = await import('~/lib/cache');
  await cacheDeletePattern(`dashboard:${ctx.tenantId}`);

  return score;
}

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

/** Fetch page content via Firecrawl API (returns markdown). */
async function fetchWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
    if (!markdown || markdown.length < 50) {
      throw new Error('Firecrawl returned insufficient content for this URL.');
    }
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
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    const rawHtml = await response.text();
    return htmlToText(rawHtml);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Detect if a URL points to a search results page and extract individual job URLs.
 * Returns an array of job URLs if it's a search page, or empty array if it's a single posting.
 */
async function extractJobUrlsFromPage(
  url: string,
  rawText: string,
  auditCtx?: { tenantId: string },
): Promise<string[]> {
  // Only attempt extraction for known job board search page patterns
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

  const isSearchPage = searchPagePatterns.some((p) => p.test(url));
  if (!isSearchPage) return [];

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
- For LinkedIn: look for /jobs/view/ or /jobs/collections/ URLs
- For Indeed: look for /viewjob or /rc/clk URLs or company job pages
- For Greenhouse: look for /jobs/ URLs with numeric IDs
- For Lever: look for individual position URLs
- If no job URLs found or this is NOT a search results page, return { "jobUrls": [], "isSearchPage": false }
- Maximum 25 URLs per page to avoid excessive API calls`,
      messages: [
        {
          role: 'user',
          content: `URL: ${url}\n\nPage content (first 8000 chars):\n${rawText.slice(0, 8000)}`,
        },
      ],
    });

    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    const latencyMs = Date.now() - startTime;

    if (auditCtx) {
      await recordLLMRun({
        tenantId: auditCtx.tenantId,
        purpose: 'extract_job_urls',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs,
        success: true,
      });
    }

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((b) => b.text)
      .join('');

    const result = parseJsonResponse<{ jobUrls: string[]; isSearchPage: boolean }>(responseText);
    if (!result.isSearchPage || !result.jobUrls?.length) return [];

    // Filter to valid HTTP URLs only
    return result.jobUrls.filter((u) => u.startsWith('http')).slice(0, 25);
  } catch {
    // If extraction fails, treat as single posting
    return [];
  }
}

/** Internal ingestion logic shared by ingestJobFromUrl and sync functions. */
export async function ingestJobFromUrlInternal(
  url: string,
  ctx: { tenantId: string; userId: string },
) {
  // 0. Deduplicate by URL first (fast check before expensive fetch+parse)
  const existingByUrl = await db.query.jobs.findFirst({
    where: and(eq(jobs.tenantId, ctx.tenantId), eq(jobs.sourceUrl, url)),
  });
  if (existingByUrl) {
    const existingScore = await db.query.jobScores.findFirst({
      where: eq(jobScores.jobId, existingByUrl.id),
    });
    return { ...existingByUrl, score: existingScore ?? null, deduplicated: true };
  }

  // 1. Fetch the URL — try Firecrawl first (handles anti-bot), fall back to direct fetch
  let rawText: string;
  const firecrawlKey = await getDecryptedApiKey('firecrawl').catch(() => null);

  if (firecrawlKey) {
    try {
      rawText = await fetchWithFirecrawl(url, firecrawlKey);
    } catch (firecrawlErr) {
      // Fall back to direct fetch if Firecrawl fails
      try {
        rawText = await fetchDirect(url);
      } catch {
        // If both fail, throw the Firecrawl error as it's more informative
        throw firecrawlErr;
      }
    }
  } else {
    rawText = await fetchDirect(url);
  }

  if (rawText.length < 50) {
    throw new Error('Page content too short to be a valid job posting. Check the URL.');
  }

  // 2. Check if this is a search results page with multiple jobs
  const jobUrls = await extractJobUrlsFromPage(url, rawText, { tenantId: ctx.tenantId });
  if (jobUrls.length > 0) {
    // This is a search page — ingest each job URL individually
    const results: any[] = [];
    for (const jobUrl of jobUrls) {
      try {
        const result = await ingestJobFromUrlInternal(jobUrl, ctx);
        results.push(result);
      } catch {
        // Skip individual failures, continue with other jobs
      }
    }
    return {
      isSearchPage: true,
      jobsExtracted: results.length,
      jobs: results,
      deduplicated: false,
    };
  }

  // 3. Parse with Claude (single job posting)
  const parsed = await callParseLLM(rawText, { tenantId: ctx.tenantId });

  // 4. Deduplicate: check for same company + title + location in this tenant
  const existing = await db.query.jobs.findFirst({
    where: and(
      eq(jobs.tenantId, ctx.tenantId),
      eq(jobs.company, parsed.company),
      eq(jobs.title, parsed.title),
      eq(jobs.location, parsed.location),
    ),
  });

  if (existing) {
    // Return the existing job with its score instead of creating a duplicate
    const existingScore = await db.query.jobScores.findFirst({
      where: eq(jobScores.jobId, existing.id),
    });
    return { ...existing, score: existingScore ?? null, deduplicated: true };
  }

  // 5. Save to jobs table
  const jobId = createId();
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
      applyUrl: parsed.applyUrl && parsed.applyUrl.startsWith('http') ? parsed.applyUrl : url,
      sourceUrl: url,
      rawDescription: rawText,
      parsedDescription: parsed.description,
    })
    .returning();

  // 6. Auto-trigger scoring
  let score = null;
  try {
    score = await scoreJobInternal(jobId, ctx);
  } catch {
    // Scoring is best-effort during ingestion; the job is still saved
    // This can fail if the candidate profile is incomplete
  }

  return { ...job, score, deduplicated: false };
}

/**
 * Ingest a job from a URL: fetch the page, parse with Claude, deduplicate,
 * save to DB, and auto-score.
 */
export const ingestJobFromUrl = createServerFn({ method: 'POST' })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`ingestJobFromUrl:${ctx.tenantId}`, 10);
    return ingestJobFromUrlInternal(data.url, ctx);
  });

/**
 * Parse a raw job description text with Claude. Returns structured data
 * without saving to the database (useful for manual paste / preview).
 */
export const parseJobDescription = createServerFn({ method: 'POST' })
  .validator((data: { text: string }) => data)
  .handler(async ({ data }) => {
    // Ensure the user is authenticated even for parsing
    const ctx = await getTenantContext();

    if (!data.text || data.text.trim().length < 50) {
      throw new Error('Job description text is too short. Provide at least 50 characters.');
    }

    const parsed = await callParseLLM(data.text.trim(), { tenantId: ctx.tenantId });
    return parsed;
  });

/**
 * Ingest a job from raw pasted text: parse with Claude, deduplicate,
 * save to DB, and auto-score. No URL fetch needed.
 */
export const ingestJobFromText = createServerFn({ method: 'POST' })
  .validator((data: { text: string; sourceLabel?: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`ingestJobFromUrl:${ctx.tenantId}`, 10);

    if (!data.text || data.text.trim().length < 50) {
      throw new Error('Job description text is too short. Provide at least 50 characters.');
    }

    const rawText = data.text.trim();
    const parsed = await callParseLLM(rawText, { tenantId: ctx.tenantId });

    // Deduplicate by content
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

    const jobId = createId();
    const applyUrl = parsed.applyUrl && parsed.applyUrl.startsWith('http') ? parsed.applyUrl : '';
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
        applyUrl: applyUrl || `pasted:${data.sourceLabel || 'manual'}`,
        sourceUrl: `pasted:${data.sourceLabel || 'manual'}:${Date.now()}`,
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
    return { ...job, score, deduplicated: false };
  });

/**
 * Score a specific job against the current candidate's profile.
 * Uses a 2-pass Claude analysis for fit and competitiveness.
 */
export const scoreJob = createServerFn({ method: 'POST' })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`scoreJob:${ctx.tenantId}`, 20);
    const score = await scoreJobInternal(data.jobId, ctx);
    return score;
  });

/**
 * Rescore all jobs for the current tenant/candidate.
 * Returns the count of jobs rescored.
 */
export const rescoreAllJobs = createServerFn({ method: 'POST' }).handler(async () => {
  const ctx = await getTenantContext();
  checkRateLimit(`rescoreAllJobs:${ctx.tenantId}`, 2);

  // Load all jobs for this tenant
  const allJobs = await db.query.jobs.findMany({
    where: eq(jobs.tenantId, ctx.tenantId),
    orderBy: [desc(jobs.createdAt)],
  });

  if (allJobs.length === 0) {
    return { count: 0 };
  }

  // Verify the candidate exists before starting
  await getCurrentCandidate(ctx);

  let scoredCount = 0;
  const errors: Array<{ jobId: string; error: string }> = [];

  // Score sequentially to avoid rate-limiting
  for (const job of allJobs) {
    try {
      await scoreJobInternal(job.id, ctx);
      scoredCount++;
    } catch (err) {
      errors.push({
        jobId: job.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return {
    count: scoredCount,
    total: allJobs.length,
    errors: errors.length > 0 ? errors : undefined,
  };
});

// ---------------------------------------------------------------------------
// Resume Parsing
// ---------------------------------------------------------------------------

/** Call Claude to extract structured data from resume text. */
async function callResumeParserLLM(resumeText: string): Promise<ParsedResume> {
  const client = await getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: RESUME_PARSER_PROMPT,
    messages: [{ role: 'user', content: resumeText }],
  });

  const responseText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return parseJsonResponse<ParsedResume>(responseText);
}

/**
 * Parse an uploaded resume using Claude AI. Downloads the file from S3,
 * extracts structured profile data, and stores the parsed content on
 * the resume record. Returns the parsed data for preview/confirmation.
 */
export const parseResume = createServerFn({ method: 'POST' })
  .validator((data: { resumeId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`parseResume:${ctx.tenantId}`, 10);
    const candidate = await getCurrentCandidate(ctx);

    // 1. Load the resume record
    const resume = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, data.resumeId),
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });

    if (!resume) {
      throw new Error('Resume not found');
    }

    // 2. Download the file content from S3
    const downloadUrl = await getDownloadUrl(resume.storageKey);
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download resume file: ${response.status}`);
    }

    const fileContent = await response.text();

    if (!fileContent || fileContent.trim().length < 20) {
      throw new Error('Resume file appears to be empty or too short to parse.');
    }

    // 3. Send to Claude for structured extraction
    const parsed = await callResumeParserLLM(fileContent.trim());

    // 4. Store the parsed content on the resume record
    await db
      .update(resumes)
      .set({
        parsedContent: parsed,
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, resume.id));

    return parsed;
  });

/**
 * Apply parsed resume data to the candidate profile. Updates the candidate's
 * basic info, bulk inserts skills, experience blocks, and projects.
 */
export const applyParsedResume = createServerFn({ method: 'POST' })
  .validator((data: { resumeId: string; parsedData: ParsedResume }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`applyParsedResume:${ctx.tenantId}`, 10);
    const candidate = await getCurrentCandidate(ctx);

    // Verify the resume belongs to this candidate
    const resume = await db.query.resumes.findFirst({
      where: and(
        eq(resumes.id, data.resumeId),
        eq(resumes.candidateId, candidate.id),
        eq(resumes.tenantId, ctx.tenantId),
      ),
    });

    if (!resume) {
      throw new Error('Resume not found');
    }

    const parsed = data.parsedData;

    // 1. Update candidate basic info
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

    // 2. Bulk insert skills
    if (parsed.skills.length > 0) {
      const skillValues = parsed.skills.map((s) => ({
        candidateId: candidate.id,
        name: s.name,
        category: s.category,
        confidenceScore: s.confidenceScore ?? 50,
        yearsUsed: s.yearsUsed,
      }));

      await db.insert(skills).values(skillValues);
    }

    // 3. Bulk insert experience blocks
    if (parsed.experience.length > 0) {
      const experienceValues = parsed.experience.map((exp) => ({
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
      }));

      await db.insert(experienceBlocks).values(experienceValues);
    }

    // 4. Bulk insert projects
    if (parsed.projects.length > 0) {
      const projectValues = parsed.projects.map((proj) => ({
        candidateId: candidate.id,
        name: proj.name,
        description: proj.description || '',
        url: proj.url,
        skills: proj.skills ?? [],
        highlights: proj.highlights ?? [],
      }));

      await db.insert(projects).values(projectValues);
    }

    return { success: true };
  });

// ---------------------------------------------------------------------------
// Resume Tailoring
// ---------------------------------------------------------------------------

interface TailoredResumeContent {
  summary: string;
  highlightedSkills: string[];
  experienceBlocks: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    bullets: string[];
    relevanceScore: number;
  }>;
  projectHighlights: Array<{
    name: string;
    description: string;
    skills: string[];
    highlights: string[];
  }>;
  gapAnalysis: {
    missingSkills: string[];
    recommendations: string[];
  };
  overallConfidence: 'high' | 'medium' | 'low';
}

/** Call Claude to generate a tailored resume for a specific job. */
async function callTailorResumeLLM(
  job: {
    title: string;
    company: string;
    location: string;
    remotePolicy: string;
    compensationMin: number | null;
    compensationMax: number | null;
    compensationType: string;
    employmentType: string;
    yearsRequired: number | null;
    mustHaveSkills: string[];
    niceToHaveSkills: string[];
    domain: string | null;
    rawDescription: string;
  },
  profile: Awaited<ReturnType<typeof loadCandidateProfile>>,
  scoreData: { overallScore: number; recommendation: string; reasoning: string } | null,
  auditCtx?: { tenantId: string; candidateId?: string; jobId?: string },
): Promise<TailoredResumeContent> {
  const client = await getClient();
  const startTime = Date.now();
  let success = false;
  let errorMsg: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  const userContent = `## JOB
${JSON.stringify(
  {
    title: job.title,
    company: job.company,
    location: job.location,
    remotePolicy: job.remotePolicy,
    compensationMin: job.compensationMin,
    compensationMax: job.compensationMax,
    compensationType: job.compensationType,
    employmentType: job.employmentType,
    yearsRequired: job.yearsRequired,
    mustHaveSkills: job.mustHaveSkills,
    niceToHaveSkills: job.niceToHaveSkills,
    domain: job.domain,
    description: job.rawDescription.slice(0, 3000),
  },
  null,
  2,
)}

## CANDIDATE
${JSON.stringify(
  {
    legalName: profile.legalName,
    preferredName: profile.preferredName,
    currentTitle: profile.currentTitle,
    currentCompany: profile.currentCompany,
    headline: profile.headline,
    summary: profile.summary,
    yearsOfExperience: profile.yearsOfExperience,
    location: profile.location,
    skills: profile.skills.map((s) => ({
      name: s.name,
      category: s.category,
      confidenceScore: s.confidenceScore,
      yearsUsed: s.yearsUsed,
    })),
    experience: profile.experience.map((e) => ({
      company: e.company,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      current: e.current,
      description: e.description,
      bullets: e.bullets,
      skills: e.skills,
    })),
  },
  null,
  2,
)}

${
  scoreData
    ? `## EXISTING SCORE ANALYSIS
${JSON.stringify(
  {
    overallScore: scoreData.overallScore,
    recommendation: scoreData.recommendation,
    reasoning: scoreData.reasoning,
  },
  null,
  2,
)}`
    : ''
}

Generate a tailored resume that emphasizes the candidate's most relevant qualifications for this specific role.`;

  try {
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

    const result = parseJsonResponse<TailoredResumeContent>(responseText);
    success = true;
    return result;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unknown error';
    throw err;
  } finally {
    const latencyMs = Date.now() - startTime;
    if (auditCtx) {
      await recordLLMRun({
        tenantId: auditCtx.tenantId,
        candidateId: auditCtx.candidateId,
        jobId: auditCtx.jobId,
        purpose: 'tailor_resume',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMsg,
      });
    }
  }
}

/**
 * Tailor a resume for a specific job using Claude AI. Loads the candidate
 * profile and job data, generates tailored content, and saves to the
 * tailoredResumes table.
 */
export const tailorResume = createServerFn({ method: 'POST' })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`tailorResume:${ctx.tenantId}`, 5);

    // 1. Load candidate profile
    const candidate = await getCurrentCandidate(ctx);
    const profile = await loadCandidateProfile(candidate.id);

    // 2. Load the target job
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, data.jobId), eq(jobs.tenantId, ctx.tenantId)),
    });
    if (!job) throw new Error('Job not found');

    // 3. Load existing score (if any)
    const existingScore = await db.query.jobScores.findFirst({
      where: and(eq(jobScores.jobId, data.jobId), eq(jobScores.candidateId, candidate.id)),
    });

    const scoreData = existingScore
      ? {
          overallScore: existingScore.overallScore,
          recommendation: existingScore.recommendation,
          reasoning: existingScore.reasoning,
        }
      : null;

    // 4. Call Claude for tailored resume content
    const tailoredContent = await callTailorResumeLLM(job, profile, scoreData, {
      tenantId: ctx.tenantId,
      candidateId: candidate.id,
      jobId: data.jobId,
    });

    // 5. Determine version (increment if one exists already)
    const existingTailored = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, data.jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });

    const nextVersion = existingTailored ? existingTailored.version + 1 : 1;

    // 6. Save to tailoredResumes table
    const tailoredId = createId();
    const [saved] = await db
      .insert(tailoredResumes)
      .values({
        id: tailoredId,
        candidateId: candidate.id,
        jobId: data.jobId,
        tenantId: ctx.tenantId,
        storageKey: `tailored/${ctx.tenantId}/${data.jobId}/${tailoredId}.json`,
        contentJson: tailoredContent,
        version: nextVersion,
      })
      .returning();

    return {
      ...saved,
      content: tailoredContent,
    };
  });

/**
 * Retrieve an existing tailored resume for a specific job.
 * Returns null if no tailored resume exists yet.
 */
export const getTailoredResume = createServerFn({ method: 'GET' })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });

    if (!candidate) return null;

    const tailored = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, data.jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });

    if (!tailored) return null;

    return {
      ...tailored,
      content: tailored.contentJson as TailoredResumeContent,
    };
  });

/**
 * Load the original (untailored) candidate profile for comparison alongside
 * a tailored resume. Returns summary, skills, experience, and projects.
 */
export const getOriginalProfile = createServerFn({ method: 'GET' })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data: _data }) => {
    const ctx = await getTenantContext();

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });

    if (!candidate) return null;

    const [candidateSkills, experience, candidateProjects] = await Promise.all([
      db.query.skills.findMany({
        where: eq(skills.candidateId, candidate.id),
      }),
      db.query.experienceBlocks.findMany({
        where: eq(experienceBlocks.candidateId, candidate.id),
        orderBy: [desc(experienceBlocks.startDate)],
      }),
      db.query.projects.findMany({
        where: eq(projects.candidateId, candidate.id),
      }),
    ]);

    return {
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
    };
  });
