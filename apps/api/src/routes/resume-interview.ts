import { Router } from 'express';
import { db } from '@job-pilot/db';
import {
  ghostwriterMessages,
  candidates,
  jobs,
  jobScores,
  tailoredResumes,
  answerBank,
} from '@job-pilot/db/schema';
import { eq, and, asc, desc, isNull } from 'drizzle-orm';
import { getTenantContext } from '../lib/context.js';
import { RESUME_INTERVIEW_PROMPT } from '@job-pilot/mastra/prompts';
import Anthropic from '@anthropic-ai/sdk';

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

const CONTEXT_VALUE = 'resume_interview';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/resume-interview/messages?jobId=xxx
// ---------------------------------------------------------------------------
router.get('/messages', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const jobId = req.query.jobId as string;
    if (!jobId) throw new Error('jobId is required');

    const messages = await db.query.ghostwriterMessages.findMany({
      where: and(
        eq(ghostwriterMessages.tenantId, ctx.tenantId),
        eq(ghostwriterMessages.jobId, jobId),
        eq(ghostwriterMessages.context, CONTEXT_VALUE),
      ),
      orderBy: [asc(ghostwriterMessages.createdAt)],
    });

    res.json(messages);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// Helper: build system prompt with full context
// ---------------------------------------------------------------------------
async function buildSystemPrompt(ctx: { tenantId: string; userId: string }, jobId: string) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found');

  const [job, score, tailored, answers] = await Promise.all([
    db.query.jobs.findFirst({ where: eq(jobs.id, jobId) }),
    db.query.jobScores.findFirst({
      where: and(eq(jobScores.jobId, jobId), eq(jobScores.candidateId, candidate.id)),
    }),
    db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    }),
    db.query.answerBank.findMany({
      where: and(eq(answerBank.tenantId, ctx.tenantId), eq(answerBank.candidateId, candidate.id)),
    }),
  ]);

  if (!job) throw new Error('Job not found');
  if (!tailored) throw new Error('No tailored resume found — generate one first');

  const contentJson = tailored.contentJson as any;

  const parts = [
    RESUME_INTERVIEW_PROMPT,
    '',
    '--- JOB CONTEXT ---',
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : '',
    `Description: ${truncate((job.parsedDescription as string) || job.rawDescription || '', 3000)}`,
  ];

  parts.push(
    '',
    '--- CANDIDATE CONTEXT ---',
    `Name: ${candidate.preferredName || candidate.legalName || 'Not provided'}`,
    `Headline: ${candidate.headline || 'Not provided'}`,
    candidate.yearsOfExperience ? `Experience: ${candidate.yearsOfExperience} years` : '',
  );

  if (score) {
    parts.push(
      '',
      '--- MATCH SCORE ---',
      `Overall: ${score.overallScore ?? 'N/A'}`,
      `Recommendation: ${score.recommendation ?? 'N/A'}`,
      score.reasoning ? `Reasoning: ${truncate(score.reasoning, 500)}` : '',
    );
  }

  parts.push(
    '',
    '--- TAILORED RESUME (contentJson) ---',
    JSON.stringify(contentJson, null, 2).slice(0, 6000),
  );

  if (contentJson?.gapAnalysis) {
    parts.push(
      '',
      '--- GAP ANALYSIS ---',
      JSON.stringify(contentJson.gapAnalysis, null, 2),
    );
  }

  if (answers.length > 0) {
    parts.push(
      '',
      '--- EXISTING ANSWER BANK (avoid probing for info already captured) ---',
      answers.slice(0, 20).map((a) => `Q: ${a.questionPattern}\nA: ${truncate(a.answer, 200)}`).join('\n\n'),
    );
  }

  return { systemPrompt: parts.filter(Boolean).join('\n'), candidate, tailored };
}

// ---------------------------------------------------------------------------
// POST /api/resume-interview/start — SSE streaming (first turn)
// ---------------------------------------------------------------------------
router.post('/start', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId } = req.body;
    if (!jobId) throw new Error('jobId is required');

    const { systemPrompt, candidate } = await buildSystemPrompt(ctx, jobId);

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
      messages: [
        { role: 'user', content: 'Please analyze my tailored resume and start the interview to help me deepen my bullet points.' },
      ],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
      }
    }

    // Parse :::plan block if present
    const planMatch = fullResponse.match(/:::plan\s*([\s\S]*?)\s*:::/);
    if (planMatch) {
      try {
        const planData = JSON.parse(planMatch[1]);
        res.write(`data: ${JSON.stringify({ type: 'plan', data: planData })}\n\n`);
      } catch {}
    }

    // Save the initial exchange as messages
    await db.insert(ghostwriterMessages).values([
      {
        id: createId(),
        jobId,
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        role: 'user',
        content: 'Please analyze my tailored resume and start the interview to help me deepen my bullet points.',
        context: CONTEXT_VALUE,
      },
      {
        id: createId(),
        jobId,
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        role: 'assistant',
        content: fullResponse,
        context: CONTEXT_VALUE,
      },
    ]);

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (e) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (e as Error).message })}\n\n`);
      res.end();
    } else {
      next(e);
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/resume-interview/chat — SSE streaming (subsequent turns)
// ---------------------------------------------------------------------------
router.post('/chat', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId, message } = req.body;
    if (!jobId || !message) throw new Error('jobId and message are required');

    const { systemPrompt, candidate } = await buildSystemPrompt(ctx, jobId);

    // Load conversation history filtered by context
    const history = await db.query.ghostwriterMessages.findMany({
      where: and(
        eq(ghostwriterMessages.tenantId, ctx.tenantId),
        eq(ghostwriterMessages.jobId, jobId),
        eq(ghostwriterMessages.context, CONTEXT_VALUE),
      ),
      orderBy: [asc(ghostwriterMessages.createdAt)],
    });

    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = history.map((m) => ({
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
      context: CONTEXT_VALUE,
    });

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

    // Parse :::enhancement block if present
    const enhancementMatch = fullResponse.match(/:::enhancement\s*([\s\S]*?)\s*:::/);
    if (enhancementMatch) {
      try {
        const enhancementData = JSON.parse(enhancementMatch[1]);
        res.write(`data: ${JSON.stringify({ type: 'enhancement', data: enhancementData })}\n\n`);
      } catch {}
    }

    // Parse :::summary block if present
    const summaryMatch = fullResponse.match(/:::summary\s*([\s\S]*?)\s*:::/);
    if (summaryMatch) {
      try {
        const summaryData = JSON.parse(summaryMatch[1]);
        res.write(`data: ${JSON.stringify({ type: 'summary', data: summaryData })}\n\n`);
      } catch {}
    }

    // Save assistant message
    await db.insert(ghostwriterMessages).values({
      id: createId(),
      jobId,
      candidateId: candidate.id,
      tenantId: ctx.tenantId,
      role: 'assistant',
      content: fullResponse,
      context: CONTEXT_VALUE,
    });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (e) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (e as Error).message })}\n\n`);
      res.end();
    } else {
      next(e);
    }
  }
});

// ---------------------------------------------------------------------------
// POST /api/resume-interview/accept-enhancement
// ---------------------------------------------------------------------------
router.post('/accept-enhancement', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId, blockIndex, bulletIndex, enhancedBullet } = req.body;
    if (!jobId || blockIndex === undefined || bulletIndex === undefined || !enhancedBullet) {
      throw new Error('jobId, blockIndex, bulletIndex, and enhancedBullet are required');
    }

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found');

    // Get latest tailored resume
    const latest = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });
    if (!latest) throw new Error('No tailored resume found');

    // Clone contentJson and replace the bullet
    const content = JSON.parse(JSON.stringify(latest.contentJson)) as any;
    if (content.experienceBlocks?.[blockIndex]?.bullets?.[bulletIndex] !== undefined) {
      content.experienceBlocks[blockIndex].bullets[bulletIndex] = enhancedBullet;
    } else {
      throw new Error('Invalid blockIndex or bulletIndex');
    }

    const nextVersion = latest.version + 1;
    const newId = createId();
    const [saved] = await db.insert(tailoredResumes).values({
      id: newId,
      candidateId: candidate.id,
      jobId,
      tenantId: ctx.tenantId,
      storageKey: `tailored/${ctx.tenantId}/${jobId}/${newId}.json`,
      contentJson: content,
      version: nextVersion,
    }).returning();

    res.json(saved);
  } catch (e) { next(e); }
});

// ---------------------------------------------------------------------------
// POST /api/resume-interview/accept-all
// Accept enhancement + save story to answer bank
// ---------------------------------------------------------------------------
router.post('/accept-all', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId, blockIndex, bulletIndex, enhancedBullet, story } = req.body;
    if (!jobId || blockIndex === undefined || bulletIndex === undefined || !enhancedBullet) {
      throw new Error('jobId, blockIndex, bulletIndex, and enhancedBullet are required');
    }

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found');

    // Get latest tailored resume
    const latest = await db.query.tailoredResumes.findFirst({
      where: and(
        eq(tailoredResumes.jobId, jobId),
        eq(tailoredResumes.candidateId, candidate.id),
        eq(tailoredResumes.tenantId, ctx.tenantId),
      ),
      orderBy: [desc(tailoredResumes.version)],
    });
    if (!latest) throw new Error('No tailored resume found');

    // Clone contentJson and replace the bullet
    const content = JSON.parse(JSON.stringify(latest.contentJson)) as any;
    if (content.experienceBlocks?.[blockIndex]?.bullets?.[bulletIndex] !== undefined) {
      content.experienceBlocks[blockIndex].bullets[bulletIndex] = enhancedBullet;
    } else {
      throw new Error('Invalid blockIndex or bulletIndex');
    }

    const nextVersion = latest.version + 1;
    const newId = createId();

    // Insert new resume version and save story in parallel
    const [savedResume] = await db.insert(tailoredResumes).values({
      id: newId,
      candidateId: candidate.id,
      jobId,
      tenantId: ctx.tenantId,
      storageKey: `tailored/${ctx.tenantId}/${jobId}/${newId}.json`,
      contentJson: content,
      version: nextVersion,
    }).returning();

    let savedAnswer = null;
    if (story?.questionPattern && story?.answer) {
      const [answer] = await db.insert(answerBank).values({
        id: createId(),
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        questionPattern: story.questionPattern,
        answer: story.answer,
        category: 'resume_interview',
      }).returning();
      savedAnswer = answer;
    }

    res.json({ resume: savedResume, answer: savedAnswer });
  } catch (e) { next(e); }
});

export default router;
