import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { applications, jobs, llmRuns, outcomes, recruiterMessages } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';
import { checkRateLimit } from '../lib/rate-limit.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const MODEL = 'claude-sonnet-4-20250514';

function parseJsonResponse<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```'))
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  return JSON.parse(cleaned) as T;
}

const EMAIL_ANALYSIS_PROMPT = `You are an email analysis assistant for a job applicant. Given a recruiter/hiring email and a list of the user's active applications, determine:\n1. Which application this email relates to\n2. What status change the email implies\n\nValid statuses: discovered, shortlisted, resume_generated, applied, recruiter_screen, technical, onsite, final, rejected, offer, withdrawn\n\nReturn JSON: { matchedApplicationIndex: number|null, detectedStatus: string|null, confidence: "high"|"medium"|"low", reasoning: string }`;

async function analyzeMessageInternal(
  messageId: string,
  ctx: { tenantId: string; userId: string },
) {
  const message = await db.query.recruiterMessages.findFirst({
    where: and(eq(recruiterMessages.id, messageId), eq(recruiterMessages.tenantId, ctx.tenantId)),
  });
  if (!message) throw new Error('Message not found');
  const appList = await db.query.applications.findMany({
    where: eq(applications.tenantId, ctx.tenantId),
    orderBy: [desc(applications.updatedAt)],
    limit: 100,
  });
  const enrichedApps = await Promise.all(
    appList.map(async (app) => ({
      ...app,
      job: await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) }),
    })),
  );
  const applicationsContext = enrichedApps.map((app, idx) => ({
    index: idx,
    company: app.job?.company ?? 'Unknown',
    title: app.job?.title ?? 'Unknown',
    currentStatus: app.status,
  }));
  const truncatedBody =
    message.body.length > 3000 ? message.body.slice(0, 3000) + '...[truncated]' : message.body;
  const userContent = `## EMAIL\nFrom: ${message.from}\nSubject: ${message.subject}\nDate: ${message.receivedAt.toISOString()}\n\nBody:\n${truncatedBody}\n\n## ACTIVE APPLICATIONS\n${JSON.stringify(applicationsContext, null, 2)}`;
  const { getClient } = await import('./ai.js');
  const client = await getClient();
  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: EMAIL_ANALYSIS_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });
    inputTokens = response.usage?.input_tokens ?? 0;
    outputTokens = response.usage?.output_tokens ?? 0;
    const responseText = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');
    const parsed = parseJsonResponse<{
      matchedApplicationIndex: number | null;
      detectedStatus: string | null;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    }>(responseText);
    const matchedApp =
      parsed.matchedApplicationIndex !== null ? enrichedApps[parsed.matchedApplicationIndex] : null;
    return {
      messageId: message.id,
      matchedApplicationId: matchedApp?.id ?? null,
      matchedCompany: matchedApp?.job?.company ?? null,
      matchedJobTitle: matchedApp?.job?.title ?? null,
      detectedStatus: parsed.detectedStatus,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      snippet: message.body.slice(0, 200).replace(/\s+/g, ' ').trim(),
    };
  } finally {
    await db
      .insert(llmRuns)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        provider: 'anthropic',
        model: MODEL,
        purpose: 'analyze_recruiter_email',
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startTime,
      })
      .catch(() => {});
  }
}

const router = Router();

router.get('/messages', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const messages = await db.query.recruiterMessages.findMany({
      where: eq(recruiterMessages.tenantId, ctx.tenantId),
      orderBy: [desc(recruiterMessages.receivedAt)],
      limit: 100,
    });
    res.json(
      messages.map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        snippet: m.body.slice(0, 200).replace(/\s+/g, ' ').trim(),
        receivedAt: m.receivedAt,
        parsed: m.parsed,
        applicationId: m.applicationId,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.post('/analyze', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`analyzeRecruitMessage:${ctx.tenantId}`, 20);
    const result = await analyzeMessageInternal(req.body.messageId, ctx);
    capture(ctx.userId, 'email_analyzed', {
      tenantId: ctx.tenantId,
      messageId: req.body.messageId,
    });
    res.json(result);
  } catch (e) {
    try {
      const c = getTenantContext();
      captureError(c.userId, 'email_analyzed', e, { tenantId: c.tenantId });
    } catch {}
    next(e);
  }
});

router.post('/analyze-unprocessed', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    checkRateLimit(`analyzeUnprocessedMessages:${ctx.tenantId}`, 3);
    const unprocessed = await db.query.recruiterMessages.findMany({
      where: and(eq(recruiterMessages.tenantId, ctx.tenantId), eq(recruiterMessages.parsed, false)),
      orderBy: [desc(recruiterMessages.receivedAt)],
      limit: 10,
    });
    if (unprocessed.length === 0) {
      res.json({ results: [], total: 0 });
      return;
    }
    const results: any[] = [];
    const errors: any[] = [];
    for (const msg of unprocessed) {
      try {
        results.push(await analyzeMessageInternal(msg.id, ctx));
      } catch (err) {
        errors.push({ messageId: msg.id, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }
    res.json({
      results,
      total: unprocessed.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/apply-status', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { messageId, applicationId, newStatus } = req.body;
    const app = await db.query.applications.findFirst({
      where: and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)),
    });
    if (!app) throw new Error('Application not found');
    const message = await db.query.recruiterMessages.findFirst({
      where: and(eq(recruiterMessages.id, messageId), eq(recruiterMessages.tenantId, ctx.tenantId)),
    });
    if (!message) throw new Error('Message not found');
    const [updated] = await db
      .update(applications)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === 'applied' ? { appliedAt: new Date() } : {}),
      })
      .where(and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)))
      .returning();
    await db.insert(outcomes).values({
      id: createId(),
      applicationId,
      stage: newStatus,
      notes: `Auto-detected from email: "${message.subject}"`,
    });
    await db
      .update(recruiterMessages)
      .set({ parsed: true, applicationId })
      .where(eq(recruiterMessages.id, messageId));
    const { notifyUser } = await import('./notifications.js');
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
    await notifyUser(ctx, {
      type: 'application_updated',
      title: 'Status updated from email',
      message: `${job?.company ?? 'Unknown'} - ${job?.title ?? 'Unknown'} moved to ${newStatus}`,
      link: `/applications/${applicationId}`,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.post('/dismiss', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const [updated] = await db
      .update(recruiterMessages)
      .set({ parsed: true })
      .where(
        and(
          eq(recruiterMessages.id, req.body.messageId),
          eq(recruiterMessages.tenantId, ctx.tenantId),
        ),
      )
      .returning();
    if (!updated) throw new Error('Message not found');
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
