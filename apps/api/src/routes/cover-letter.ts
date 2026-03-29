import Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, coverLetters, jobs, jobScores, tailoredResumes } from '@job-pilot/db/schema';
import { COVER_LETTER_PROMPT } from '@job-pilot/mastra/prompts';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { getClient, loadCandidateProfile, parseJsonResponse, recordLLMRun } from './ai.js';

const MODEL = 'claude-sonnet-4-20250514';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found.');
  return candidate;
}

const router = Router();

// Generate cover letter for a job
router.post('/generate', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`coverLetter:${ctx.tenantId}`, 5);

    const { jobId } = req.body;
    if (!jobId) throw new Error('jobId is required');

    const candidate = await getCurrentCandidate(ctx);
    const profile = await loadCandidateProfile(candidate.id);

    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.tenantId, ctx.tenantId)),
    });
    if (!job) throw new Error('Job not found');

    // Get score data if available
    const existingScore = await db.query.jobScores.findFirst({
      where: and(eq(jobScores.jobId, jobId), eq(jobScores.candidateId, candidate.id)),
    });
    const scoreData = existingScore
      ? {
          overallScore: existingScore.overallScore,
          recommendation: existingScore.recommendation,
          reasoning: existingScore.reasoning,
        }
      : null;

    // Get tailored resume if available
    const tailored = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });

    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;

    const userContent = `## JOB
${JSON.stringify(
  {
    title: job.title,
    company: job.company,
    location: job.location,
    remotePolicy: job.remotePolicy,
    mustHaveSkills: job.mustHaveSkills,
    niceToHaveSkills: job.niceToHaveSkills,
    domain: job.domain,
    description: (job.rawDescription || '').slice(0, 3000),
  },
  null,
  2,
)}

## CANDIDATE
${JSON.stringify(
  {
    name: profile.legalName || profile.preferredName || 'Candidate',
    currentTitle: profile.currentTitle,
    currentCompany: profile.currentCompany,
    headline: profile.headline,
    summary: profile.summary,
    yearsOfExperience: profile.yearsOfExperience,
    skills: profile.skills.map((s: any) => ({ name: s.name, category: s.category })),
    experience: profile.experience.slice(0, 5).map((e: any) => ({
      company: e.company,
      title: e.title,
      description: e.description,
      skills: e.skills,
    })),
  },
  null,
  2,
)}${
      scoreData
        ? `

## SCORE ALIGNMENT
${JSON.stringify(scoreData, null, 2)}`
        : ''
    }${
      tailored
        ? `

## TAILORED RESUME HIGHLIGHTS
${JSON.stringify(
  {
    summary: (tailored.contentJson as any)?.summary,
    highlightedSkills: (tailored.contentJson as any)?.highlightedSkills,
  },
  null,
  2,
)}`
        : ''
    }

Generate a tailored cover letter.`;

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: COVER_LETTER_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    inputTokens = message.usage?.input_tokens ?? 0;
    outputTokens = message.usage?.output_tokens ?? 0;

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const result = parseJsonResponse<{ content: string; contentHtml: string }>(responseText);

    await recordLLMRun({
      tenantId: ctx.tenantId,
      candidateId: candidate.id,
      jobId,
      purpose: 'generate_cover_letter',
      model: MODEL,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startTime,
      success: true,
    });

    // Check for existing cover letter to increment version
    const existing = await db.query.coverLetters.findFirst({
      where: and(
        eq(coverLetters.jobId, jobId),
        eq(coverLetters.candidateId, candidate.id),
        eq(coverLetters.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(coverLetters.version)],
    });
    const nextVersion = existing ? existing.version + 1 : 1;

    const [saved] = await db
      .insert(coverLetters)
      .values({
        id: createId(),
        candidateId: candidate.id,
        jobId,
        tenantId: ctx.tenantId,
        content: result.content,
        contentHtml: result.contentHtml || null,
        version: nextVersion,
      })
      .returning();

    capture(ctx.userId, 'cover_letter_generated', { tenantId: ctx.tenantId, jobId });
    res.json(saved);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'cover_letter_generated', e, {
        tenantId: ctx.tenantId,
        jobId: req.body.jobId,
      });
    } catch {}
    next(e);
  }
});

// Get existing cover letter for a job
router.get('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId } = req.query as { jobId: string };
    if (!jobId) throw new Error('jobId query parameter is required');

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.json(null);
      return;
    }

    const letter = await db.query.coverLetters.findFirst({
      where: and(
        eq(coverLetters.jobId, jobId),
        eq(coverLetters.candidateId, candidate.id),
        eq(coverLetters.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(coverLetters.version)],
    });

    res.json(letter || null);
  } catch (e) {
    next(e);
  }
});

export default router;
