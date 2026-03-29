import Anthropic from '@anthropic-ai/sdk';
import { and, asc, eq } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '@job-pilot/db';
import {
  candidates,
  coverLetters,
  ghostwriterMessages,
  jobs,
  jobScores,
} from '@job-pilot/db/schema';
import { GHOSTWRITER_PROMPT } from '@job-pilot/mastra/prompts';

import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  return new Anthropic({ apiKey });
}

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text || '';
  return text.slice(0, max) + '...';
}

const router = Router();

// GET /api/ghostwriter/messages?jobId=xxx
router.get('/messages', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const jobId = req.query.jobId as string;
    if (!jobId) throw new Error('jobId is required');

    const messages = await db.query.ghostwriterMessages.findMany({
      where: and(
        eq(ghostwriterMessages.tenantId, ctx.tenantId),
        eq(ghostwriterMessages.jobId, jobId),
      ),
      orderBy: [asc(ghostwriterMessages.createdAt)],
    });

    res.json(messages);
  } catch (e) {
    next(e);
  }
});

// POST /api/ghostwriter/chat — SSE streaming
router.post('/chat', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId, message } = req.body;
    if (!jobId || !message) throw new Error('jobId and message are required');

    // Load context
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found');

    const [job, score, coverLetter, history] = await Promise.all([
      db.query.jobs.findFirst({ where: eq(jobs.id, jobId) }),
      db.query.jobScores.findFirst({
        where: and(eq(jobScores.jobId, jobId), eq(jobScores.candidateId, candidate.id)),
      }),
      db.query.coverLetters.findFirst({
        where: and(eq(coverLetters.jobId, jobId), eq(coverLetters.tenantId, ctx.tenantId)),
      }),
      db.query.ghostwriterMessages.findMany({
        where: and(
          eq(ghostwriterMessages.tenantId, ctx.tenantId),
          eq(ghostwriterMessages.jobId, jobId),
        ),
        orderBy: [asc(ghostwriterMessages.createdAt)],
      }),
    ]);

    if (!job) throw new Error('Job not found');

    // Build system context
    const contextParts = [
      GHOSTWRITER_PROMPT,
      '',
      '--- JOB CONTEXT ---',
      `Title: ${job.title}`,
      `Company: ${job.company}`,
      job.location ? `Location: ${job.location}` : '',
      `Description: ${truncate((job.parsedDescription as string) || job.rawDescription || '', 3000)}`,
      '',
      '--- CANDIDATE CONTEXT ---',
      `Name: ${candidate.preferredName || candidate.legalName || 'Not provided'}`,
      `Headline: ${candidate.headline || 'Not provided'}`,
      candidate.yearsOfExperience ? `Experience: ${candidate.yearsOfExperience} years` : '',
    ];

    if (score) {
      contextParts.push(
        '',
        '--- MATCH SCORE ---',
        `Overall: ${score.overallScore ?? 'N/A'}`,
        `Recommendation: ${score.recommendation ?? 'N/A'}`,
        score.reasoning ? `Reasoning: ${truncate(score.reasoning as string, 500)}` : '',
      );
    }

    if (coverLetter) {
      contextParts.push('', '--- COVER LETTER ---', truncate(coverLetter.content, 1500));
    }

    const systemPrompt = contextParts.filter(Boolean).join('\n');

    // Build messages array
    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
      history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    conversationMessages.push({ role: 'user', content: message });

    // Save user message
    await db.insert(ghostwriterMessages).values({
      id: createId(),
      jobId,
      candidateId: candidate.id,
      tenantId: ctx.tenantId,
      role: 'user',
      content: message,
    });

    capture(ctx.userId, 'ghostwriter_message_sent', { tenantId: ctx.tenantId, jobId });

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = getAnthropicClient();
    let fullResponse = '';

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: conversationMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
      }
    }

    // Save assistant message
    await db.insert(ghostwriterMessages).values({
      id: createId(),
      jobId,
      candidateId: candidate.id,
      tenantId: ctx.tenantId,
      role: 'assistant',
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'ghostwriter_message_sent', e, { tenantId: ctx.tenantId });
    } catch {}
    // If headers already sent (SSE started), end gracefully
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (e as Error).message })}\n\n`);
      res.end();
    } else {
      next(e);
    }
  }
});

// POST /api/ghostwriter/save-to-answers — save assistant message to answer bank
router.post('/save-to-answers', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { question, answer } = req.body;
    if (!answer) throw new Error('answer is required');

    const { answerBank } = await import('@job-pilot/db/schema');

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found');

    const [saved] = await db
      .insert(answerBank)
      .values({
        id: createId(),
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        questionPattern: question || 'Ghostwriter response',
        answer,
        category: 'ghostwriter',
      })
      .returning();

    capture(ctx.userId, 'ghostwriter_answer_saved', { tenantId: ctx.tenantId });
    res.json(saved);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'ghostwriter_answer_saved', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

export default router;
