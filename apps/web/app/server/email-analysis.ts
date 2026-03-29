import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { recruiterMessages, applications, jobs, outcomes, llmRuns } from '@job-pilot/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';
import { checkRateLimit } from '~/lib/rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const MODEL = 'claude-sonnet-4-20250514';

/** Parse Claude's response text as JSON, handling potential markdown fences. */
function parseJsonResponse<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned) as T;
}

/** Record an LLM call for auditing. */
async function recordLLMRun(params: {
  tenantId: string;
  purpose: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailAnalysisResult {
  messageId: string;
  matchedApplicationId: string | null;
  matchedCompany: string | null;
  matchedJobTitle: string | null;
  detectedStatus: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const EMAIL_ANALYSIS_PROMPT = `You are an email analysis assistant for a job applicant. Given a recruiter/hiring email and a list of the user's active applications, determine:

1. Which application (if any) this email relates to, based on company name, job title, or other contextual clues.
2. What status change the email implies for that application.

Valid application statuses (in order of progression):
- discovered: Just found the job
- shortlisted: Added to shortlist
- resume_generated: Resume tailored
- applied: Application submitted
- recruiter_screen: Recruiter phone screen / initial chat
- technical: Technical interview / coding challenge
- onsite: On-site or virtual on-site interview
- final: Final round / team matching
- rejected: Application rejected / not moving forward
- offer: Job offer received
- withdrawn: Candidate withdrew

Status detection heuristics:
- "unfortunately" / "not moving forward" / "other candidates" / "not a fit" / "decided not to proceed" -> rejected
- "schedule an interview" / "phone screen" / "chat" / "introductory call" -> recruiter_screen
- "technical interview" / "coding challenge" / "take-home" / "assessment" -> technical
- "on-site" / "virtual onsite" / "meet the team" / "panel interview" -> onsite
- "final round" / "final interview" / "team matching" -> final
- "offer" / "compensation" / "start date" / "excited to extend" -> offer
- "next steps" / "moving forward" -> advance to the next logical stage

Return a JSON object:
{
  "matchedApplicationIndex": number | null,
  "detectedStatus": string | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": string
}

Rules:
- matchedApplicationIndex is the 0-based index into the provided applications list, or null if no match
- Only suggest a status that is a logical progression from the current status (don't go backwards)
- If the email is generic/newsletter/unrelated, set matchedApplicationIndex to null and detectedStatus to null
- Be conservative: use "low" confidence unless the signal is very clear
- Return ONLY valid JSON, no other text`;

// ---------------------------------------------------------------------------
// Internal analysis function
// ---------------------------------------------------------------------------

async function analyzeMessageInternal(
  messageId: string,
  ctx: { tenantId: string; userId: string },
): Promise<EmailAnalysisResult> {
  // 1. Load the message
  const message = await db.query.recruiterMessages.findFirst({
    where: and(
      eq(recruiterMessages.id, messageId),
      eq(recruiterMessages.tenantId, ctx.tenantId),
    ),
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // 2. Load all applications with their associated jobs
  const appList = await db.query.applications.findMany({
    where: eq(applications.tenantId, ctx.tenantId),
    orderBy: [desc(applications.updatedAt)],
    limit: 100,
  });

  const enrichedApps = await Promise.all(
    appList.map(async (app) => {
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, app.jobId),
      });
      return { ...app, job };
    }),
  );

  // 3. Build context for Claude
  const applicationsContext = enrichedApps.map((app, idx) => ({
    index: idx,
    company: app.job?.company ?? 'Unknown',
    title: app.job?.title ?? 'Unknown',
    currentStatus: app.status,
    appliedAt: app.appliedAt?.toISOString() ?? null,
  }));

  // Truncate body to avoid excessive token usage
  const truncatedBody = message.body.length > 3000
    ? message.body.slice(0, 3000) + '...[truncated]'
    : message.body;

  const userContent = `## EMAIL
From: ${message.from}
Subject: ${message.subject}
Date: ${message.receivedAt.toISOString()}

Body:
${truncatedBody}

## ACTIVE APPLICATIONS
${JSON.stringify(applicationsContext, null, 2)}`;

  // 4. Call Claude via dynamic import
  const { getClient } = await import('./ai');
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

    // Map the matched index back to application data
    const matchedApp = parsed.matchedApplicationIndex !== null
      ? enrichedApps[parsed.matchedApplicationIndex]
      : null;

    // Build a short snippet from the email for UI display
    const snippet = message.body.slice(0, 200).replace(/\s+/g, ' ').trim();

    return {
      messageId: message.id,
      matchedApplicationId: matchedApp?.id ?? null,
      matchedCompany: matchedApp?.job?.company ?? null,
      matchedJobTitle: matchedApp?.job?.title ?? null,
      detectedStatus: parsed.detectedStatus,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      snippet,
    };
  } finally {
    const latencyMs = Date.now() - startTime;
    await recordLLMRun({
      tenantId: ctx.tenantId,
      purpose: 'analyze_recruiter_email',
      model: MODEL,
      inputTokens,
      outputTokens,
      latencyMs,
    });
  }
}

// ---------------------------------------------------------------------------
// Server Functions
// ---------------------------------------------------------------------------

/**
 * List recruiter messages for the current tenant, with their parsed status.
 */
export const listRecruiterMessages = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const messages = await db.query.recruiterMessages.findMany({
    where: eq(recruiterMessages.tenantId, ctx.tenantId),
    orderBy: [desc(recruiterMessages.receivedAt)],
    limit: 100,
  });

  return messages.map((m) => ({
    id: m.id,
    from: m.from,
    subject: m.subject,
    snippet: m.body.slice(0, 200).replace(/\s+/g, ' ').trim(),
    receivedAt: m.receivedAt,
    parsed: m.parsed,
    applicationId: m.applicationId,
  }));
});

/**
 * Analyze a single recruiter message. Calls Claude to detect which
 * application it relates to and what status change it implies.
 * Returns the analysis WITHOUT applying any changes.
 */
export const analyzeRecruitMessage = createServerFn({ method: 'POST' }).validator(
  (data: { messageId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  checkRateLimit(`analyzeRecruitMessage:${ctx.tenantId}`, 20);

  return analyzeMessageInternal(data.messageId, ctx);
});

/**
 * Batch analyze all unprocessed (parsed=false) recruiter messages.
 * Returns an array of analysis results.
 */
export const analyzeUnprocessedMessages = createServerFn({ method: 'POST' }).handler(async () => {
  const ctx = await getTenantContext();
  checkRateLimit(`analyzeUnprocessedMessages:${ctx.tenantId}`, 3);

  // Find all unprocessed messages
  const unprocessed = await db.query.recruiterMessages.findMany({
    where: and(
      eq(recruiterMessages.tenantId, ctx.tenantId),
      eq(recruiterMessages.parsed, false),
    ),
    orderBy: [desc(recruiterMessages.receivedAt)],
    limit: 10, // Cap at 10 to avoid excessive API usage
  });

  if (unprocessed.length === 0) {
    return { results: [], total: 0 };
  }

  const results: EmailAnalysisResult[] = [];
  const errors: Array<{ messageId: string; error: string }> = [];

  // Process sequentially to avoid rate-limiting the Claude API
  for (const msg of unprocessed) {
    try {
      const result = await analyzeMessageInternal(msg.id, ctx);
      results.push(result);
    } catch (err) {
      errors.push({
        messageId: msg.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { results, total: unprocessed.length, errors: errors.length > 0 ? errors : undefined };
});

/**
 * Apply a detected status change after user confirmation.
 * Updates the application status and marks the message as parsed.
 */
export const applyDetectedStatusChange = createServerFn({ method: 'POST' }).validator(
  (data: {
    messageId: string;
    applicationId: string;
    newStatus: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  // 1. Verify the application belongs to this tenant
  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, data.applicationId),
      eq(applications.tenantId, ctx.tenantId),
    ),
  });

  if (!app) {
    throw new Error('Application not found');
  }

  // 2. Verify the message belongs to this tenant
  const message = await db.query.recruiterMessages.findFirst({
    where: and(
      eq(recruiterMessages.id, data.messageId),
      eq(recruiterMessages.tenantId, ctx.tenantId),
    ),
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // 3. Update the application status
  const [updated] = await db
    .update(applications)
    .set({
      status: data.newStatus,
      updatedAt: new Date(),
      ...(data.newStatus === 'applied' ? { appliedAt: new Date() } : {}),
    })
    .where(
      and(
        eq(applications.id, data.applicationId),
        eq(applications.tenantId, ctx.tenantId),
      ),
    )
    .returning();

  // 4. Record an outcome entry for the status change
  await db.insert(outcomes).values({
    id: createId(),
    applicationId: data.applicationId,
    stage: data.newStatus,
    notes: `Auto-detected from email: "${message.subject}"`,
  });

  // 5. Mark the message as parsed and link to the application
  await db
    .update(recruiterMessages)
    .set({
      parsed: true,
      applicationId: data.applicationId,
    })
    .where(eq(recruiterMessages.id, data.messageId));

  // 6. Send notification
  const { notifyUser } = await import('./notifications');
  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, app.jobId),
  });

  await notifyUser(ctx, {
    type: 'application_updated',
    title: 'Status updated from email',
    message: `${job?.company ?? 'Unknown'} - ${job?.title ?? 'Unknown'} moved to ${data.newStatus}`,
    link: `/applications/${data.applicationId}`,
  });

  return updated;
});

/**
 * Dismiss a detected status change. Marks the message as parsed
 * without applying any changes.
 */
export const dismissDetectedChange = createServerFn({ method: 'POST' }).validator(
  (data: { messageId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  const [updated] = await db
    .update(recruiterMessages)
    .set({ parsed: true })
    .where(
      and(
        eq(recruiterMessages.id, data.messageId),
        eq(recruiterMessages.tenantId, ctx.tenantId),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error('Message not found');
  }

  return { success: true };
});
