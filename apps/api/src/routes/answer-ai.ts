import Anthropic from '@anthropic-ai/sdk';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '@job-pilot/db';
import {
  answerBank,
  applicationQuestions,
  applications,
  candidates,
  experienceBlocks,
  jobs,
  llmRuns,
  skills,
} from '@job-pilot/db/schema';
import { DETECT_QUESTIONS_PROMPT, SUGGEST_ANSWER_PROMPT } from '@job-pilot/mastra/prompts';

import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { sanitizeText } from '../lib/sanitize.js';
import { getClient, loadCandidateProfile, parseJsonResponse } from './ai.js';

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

router.post('/detect-questions', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`answerAI:${ctx.tenantId}`, 5);
    const { applicationId, jobDescription } = req.body;
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)),
    });
    if (!application) throw new Error('Application not found');
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, application.jobId) });
    if (!job) throw new Error('Job not found');
    const descriptionText =
      (jobDescription ? sanitizeText(jobDescription) : '') ||
      job.rawDescription ||
      job.parsedDescription ||
      '';
    if (descriptionText.length < 30) throw new Error('Job description too short.');
    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    const userContent = `## JOB\nCompany: ${job.company}\nTitle: ${job.title}\nSkills: ${(job.mustHaveSkills as string[] | null)?.join(', ') ?? 'N/A'}\n\n${descriptionText.slice(0, 4000)}`;
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: DETECT_QUESTIONS_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    inputTokens = message.usage?.input_tokens ?? 0;
    outputTokens = message.usage?.output_tokens ?? 0;
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const detectedQuestions = parseJsonResponse<any[]>(responseText);
    await db
      .insert(llmRuns)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        provider: 'anthropic',
        model: MODEL,
        purpose: 'detect_application_questions',
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
      })
      .catch(() => {});
    const savedQuestions = [];
    for (const q of detectedQuestions) {
      const [saved] = await db
        .insert(applicationQuestions)
        .values({ id: createId(), applicationId, question: q.question, confidence: q.likelihood })
        .returning();
      savedQuestions.push({ ...saved, category: q.category, likelihood: q.likelihood });
    }
    capture(ctx.userId, 'questions_detected', {
      tenantId: ctx.tenantId,
      applicationId,
      count: savedQuestions.length,
    });
    res.json(savedQuestions);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'questions_detected', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/suggest-answer', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`answerAI:${ctx.tenantId}`, 5);
    const { questionId, applicationId, questionText } = req.body;
    const sanitizedQuestion = sanitizeText(questionText);
    const candidate = await getCurrentCandidate(ctx);
    const profile = await loadCandidateProfile(candidate.id);
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)),
    });
    if (!application) throw new Error('Application not found');
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, application.jobId) });
    const keywords = sanitizedQuestion
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);
    let similarAnswers: any[] = [];
    if (keywords.length > 0) {
      const conditions = keywords.map((kw) =>
        or(ilike(answerBank.questionPattern, `%${kw}%`), ilike(answerBank.answer, `%${kw}%`)),
      );
      similarAnswers = await db
        .select({
          id: answerBank.id,
          questionPattern: answerBank.questionPattern,
          answer: answerBank.answer,
          category: answerBank.category,
        })
        .from(answerBank)
        .where(
          and(
            eq(answerBank.candidateId, candidate.id),
            eq(answerBank.tenantId, ctx.tenantId),
            or(...conditions),
          ),
        )
        .limit(5);
    }
    const client = await getClient();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    const userContent = `## QUESTION\n${sanitizedQuestion}\n\n## JOB\n${job ? `${job.company} - ${job.title}\n${(job.rawDescription ?? '').slice(0, 2000)}` : 'N/A'}\n\n## CANDIDATE\n${JSON.stringify({ currentTitle: profile.currentTitle, skills: profile.skills.map((s) => ({ name: s.name })), experience: profile.experience.slice(0, 5).map((e) => ({ company: e.company, title: e.title, description: e.description })) }, null, 2)}\n\n## SIMILAR ANSWERS\n${similarAnswers.length > 0 ? similarAnswers.map((a, i) => `${i + 1}. Q: ${a.questionPattern}\n   A: ${a.answer.slice(0, 500)}`).join('\n\n') : 'None'}`;
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SUGGEST_ANSWER_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    inputTokens = message.usage?.input_tokens ?? 0;
    outputTokens = message.usage?.output_tokens ?? 0;
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    const suggestion = parseJsonResponse<any>(responseText);
    await db
      .insert(llmRuns)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        provider: 'anthropic',
        model: MODEL,
        purpose: 'suggest_answer',
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
      })
      .catch(() => {});
    await db
      .update(applicationQuestions)
      .set({
        suggestedAnswer: suggestion.suggestedAnswer,
        confidence: suggestion.confidence,
        sourceEvidence: suggestion.sourceEvidence,
      })
      .where(eq(applicationQuestions.id, questionId));
    capture(ctx.userId, 'answer_suggested', {
      tenantId: ctx.tenantId,
      questionId,
      applicationId,
    });
    res.json({
      ...suggestion,
      questionId,
      similarAnswers: similarAnswers.map((a) => ({
        id: a.id,
        questionPattern: a.questionPattern,
        answerPreview: a.answer.slice(0, 200),
      })),
    });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'answer_suggested', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/search-similar', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const sanitizedSearch = sanitizeText(req.body.searchText);
    if (sanitizedSearch.length < 3) throw new Error('Search text must be at least 3 characters.');
    const candidate = await getCurrentCandidate(ctx);
    const keywords = sanitizedSearch
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 8);
    if (keywords.length === 0) {
      res.json([]);
      return;
    }
    const conditions = keywords.map((kw) =>
      or(ilike(answerBank.questionPattern, `%${kw}%`), ilike(answerBank.answer, `%${kw}%`)),
    );
    const results = await db
      .select({
        id: answerBank.id,
        questionPattern: answerBank.questionPattern,
        answer: answerBank.answer,
        category: answerBank.category,
        context: answerBank.context,
        timesUsed: answerBank.timesUsed,
        updatedAt: answerBank.updatedAt,
      })
      .from(answerBank)
      .where(
        and(
          eq(answerBank.candidateId, candidate.id),
          eq(answerBank.tenantId, ctx.tenantId),
          or(...conditions),
        ),
      )
      .limit(5);
    const scored = results
      .map((r) => {
        const text = `${r.questionPattern} ${r.answer}`.toLowerCase();
        let hits = 0;
        for (const kw of keywords) if (text.includes(kw)) hits++;
        return { ...r, relevance: Math.round((hits / keywords.length) * 100) };
      })
      .sort((a, b) => b.relevance - a.relevance);
    res.json(scored);
  } catch (e) {
    next(e);
  }
});

router.get('/questions', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { applicationId } = req.query as { applicationId: string };
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)),
    });
    if (!application) throw new Error('Application not found');
    res.json(
      await db.query.applicationQuestions.findMany({
        where: eq(applicationQuestions.applicationId, applicationId),
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.post('/approve-answer', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { questionId, applicationId, finalAnswer, category, questionText } = req.body;
    const sanitizedAnswer = sanitizeText(finalAnswer);
    const sanitizedQuestion = sanitizeText(questionText);
    await db
      .update(applicationQuestions)
      .set({ finalAnswer: sanitizedAnswer, approved: true })
      .where(eq(applicationQuestions.id, questionId));
    const [bankEntry] = await db
      .insert(answerBank)
      .values({
        id: createId(),
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        questionPattern: sanitizedQuestion,
        category,
        answer: sanitizedAnswer,
        context: `Auto-saved from application ${applicationId}`,
        timesUsed: 1,
        lastUsed: new Date(),
      })
      .returning();
    capture(ctx.userId, 'answer_approved', {
      tenantId: ctx.tenantId,
      questionId,
      applicationId,
    });
    res.json(bankEntry);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'answer_approved', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/dismiss-question', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    await db
      .update(applicationQuestions)
      .set({ suggestedAnswer: null, approved: false })
      .where(eq(applicationQuestions.id, req.body.questionId));
    capture(ctx.userId, 'question_dismissed', {
      tenantId: ctx.tenantId,
      questionId: req.body.questionId,
    });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
