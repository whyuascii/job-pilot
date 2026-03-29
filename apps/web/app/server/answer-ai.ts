import Anthropic from '@anthropic-ai/sdk';
import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
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
import { getTenantContext } from '~/lib/api';
import { checkRateLimit } from '~/lib/rate-limit';
import { sanitizeText } from '~/lib/sanitize';
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

async function getClient(): Promise<Anthropic> {
  const apiKey = await getDecryptedApiKey('anthropic');
  if (!apiKey)
    throw new Error(
      'ANTHROPIC_API_KEY not configured. Add it to your .env file or set it in Settings.',
    );
  return new Anthropic({ apiKey });
}

function parseJsonResponse<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return JSON.parse(cleaned) as T;
}

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate)
    throw new Error('No candidate profile found. Create one before using AI features.');
  return candidate;
}

async function loadCandidateProfile(candidateId: string) {
  const [candidate, candidateSkills, experience] = await Promise.all([
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
  ]);

  if (!candidate) throw new Error('Candidate not found');

  return {
    ...candidate,
    skills: candidateSkills,
    experience,
  };
}

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
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectedQuestion {
  question: string;
  category: string;
  likelihood: 'high' | 'medium' | 'low';
}

interface SuggestedAnswer {
  suggestedAnswer: string;
  confidence: 'high' | 'medium' | 'low';
  sourceEvidence: string;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Server Functions
// ---------------------------------------------------------------------------

/**
 * Detect application questions from a job description.
 * Calls Claude to analyze the job description and extract likely questions.
 * Saves detected questions to the applicationQuestions table.
 */
export const detectApplicationQuestions = createServerFn({ method: 'POST' })
  .validator((data: { applicationId: string; jobDescription?: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`answerAI:${ctx.tenantId}`, 5);

    const sanitizedDescription = data.jobDescription
      ? sanitizeText(data.jobDescription)
      : undefined;

    // Load the application and its associated job
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, data.applicationId), eq(applications.tenantId, ctx.tenantId)),
    });

    if (!application) throw new Error('Application not found');

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, application.jobId),
    });

    if (!job) throw new Error('Job not found for this application');

    // Use provided description or fall back to the job's raw description
    const descriptionText =
      sanitizedDescription || job.rawDescription || job.parsedDescription || '';

    if (descriptionText.length < 30) {
      throw new Error(
        'Job description is too short to detect questions. Please provide more detail.',
      );
    }

    const client = await getClient();
    const startTime = Date.now();
    let success = false;
    let errorMsg: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const userContent = `## JOB DESCRIPTION
Company: ${job.company}
Title: ${job.title}
Location: ${job.location ?? 'Not specified'}
Skills Required: ${(job.mustHaveSkills as string[] | null)?.join(', ') ?? 'Not specified'}
Nice-to-Have: ${(job.niceToHaveSkills as string[] | null)?.join(', ') ?? 'Not specified'}

${descriptionText.slice(0, 4000)}`;

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

      const detectedQuestions = parseJsonResponse<DetectedQuestion[]>(responseText);
      success = true;

      // Save detected questions to the applicationQuestions table
      const savedQuestions = [];
      for (const q of detectedQuestions) {
        const questionId = createId();
        const [saved] = await db
          .insert(applicationQuestions)
          .values({
            id: questionId,
            applicationId: data.applicationId,
            question: q.question,
            confidence: q.likelihood,
          })
          .returning();
        savedQuestions.push({
          ...saved,
          category: q.category,
          likelihood: q.likelihood,
        });
      }

      return savedQuestions;
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      await recordLLMRun({
        tenantId: ctx.tenantId,
        jobId: job.id,
        purpose: 'detect_application_questions',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMsg,
      });
    }
  });

/**
 * Suggest an answer for a given question.
 * Searches the answer bank for similar answers, loads the candidate profile,
 * and calls Claude to generate a tailored answer suggestion.
 */
export const suggestAnswer = createServerFn({ method: 'POST' })
  .validator((data: { questionId: string; applicationId: string; questionText: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    checkRateLimit(`answerAI:${ctx.tenantId}`, 5);

    const sanitizedQuestion = sanitizeText(data.questionText);

    const candidate = await getCurrentCandidate(ctx);
    const profile = await loadCandidateProfile(candidate.id);

    // Load the application and job context
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, data.applicationId), eq(applications.tenantId, ctx.tenantId)),
    });

    if (!application) throw new Error('Application not found');

    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, application.jobId),
    });

    // Search for similar answers in the answer bank
    const keywords = sanitizedQuestion
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    let similarAnswers: Array<{
      id: string;
      questionPattern: string;
      answer: string;
      category: string;
    }> = [];

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
    let success = false;
    let errorMsg: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const userContent = `## APPLICATION QUESTION
${sanitizedQuestion}

## JOB CONTEXT
${job ? `Company: ${job.company}\nTitle: ${job.title}\nDescription: ${(job.rawDescription ?? job.parsedDescription ?? '').slice(0, 2000)}` : 'No job context available'}

## CANDIDATE PROFILE
${JSON.stringify(
  {
    currentTitle: profile.currentTitle,
    currentCompany: profile.currentCompany,
    headline: profile.headline,
    summary: profile.summary,
    yearsOfExperience: profile.yearsOfExperience,
    skills: profile.skills.map((s) => ({
      name: s.name,
      category: s.category,
      yearsUsed: s.yearsUsed,
    })),
    experience: profile.experience.slice(0, 5).map((e) => ({
      company: e.company,
      title: e.title,
      description: e.description,
      bullets: e.bullets,
      skills: e.skills,
    })),
  },
  null,
  2,
)}

## SIMILAR ANSWERS FROM ANSWER BANK
${
  similarAnswers.length > 0
    ? similarAnswers
        .map((a, i) => `${i + 1}. Q: ${a.questionPattern}\n   A: ${a.answer.slice(0, 500)}`)
        .join('\n\n')
    : 'No similar answers found in the answer bank.'
}`;

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

      const suggestion = parseJsonResponse<SuggestedAnswer>(responseText);
      success = true;

      // Update the applicationQuestion record with the suggestion (don't save as final)
      await db
        .update(applicationQuestions)
        .set({
          suggestedAnswer: suggestion.suggestedAnswer,
          confidence: suggestion.confidence,
          sourceEvidence: suggestion.sourceEvidence,
        })
        .where(eq(applicationQuestions.id, data.questionId));

      return {
        ...suggestion,
        questionId: data.questionId,
        similarAnswers: similarAnswers.map((a) => ({
          id: a.id,
          questionPattern: a.questionPattern,
          answerPreview: a.answer.slice(0, 200),
        })),
      };
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      await recordLLMRun({
        tenantId: ctx.tenantId,
        candidateId: candidate.id,
        jobId: job?.id,
        purpose: 'suggest_answer',
        model: MODEL,
        inputTokens,
        outputTokens,
        latencyMs,
        success,
        error: errorMsg,
      });
    }
  });

/**
 * Search similar answers in the answer bank using text matching (ILIKE).
 * Returns top 5 matches with relevance ranking.
 */
export const searchSimilarAnswers = createServerFn({ method: 'POST' })
  .validator((data: { searchText: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    const sanitizedSearch = sanitizeText(data.searchText);

    if (sanitizedSearch.length < 3) {
      throw new Error('Search text must be at least 3 characters.');
    }

    const candidate = await getCurrentCandidate(ctx);

    // Extract keywords for matching
    const keywords = sanitizedSearch
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 8);

    if (keywords.length === 0) {
      return [];
    }

    // Build ILIKE conditions for each keyword against both question and answer
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

    // Compute a simple relevance score based on keyword hit count
    const scored = results.map((r) => {
      const text = `${r.questionPattern} ${r.answer}`.toLowerCase();
      let hits = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) hits++;
      }
      const relevance = Math.round((hits / keywords.length) * 100);
      return { ...r, relevance };
    });

    // Sort by relevance descending
    scored.sort((a, b) => b.relevance - a.relevance);

    return scored;
  });

/**
 * Get existing application questions for an application.
 */
export const getApplicationQuestions = createServerFn({ method: 'GET' })
  .validator((data: { applicationId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // Verify the application belongs to this tenant
    const application = await db.query.applications.findFirst({
      where: and(eq(applications.id, data.applicationId), eq(applications.tenantId, ctx.tenantId)),
    });

    if (!application) throw new Error('Application not found');

    const questions = await db.query.applicationQuestions.findMany({
      where: eq(applicationQuestions.applicationId, data.applicationId),
    });

    return questions;
  });

/**
 * Approve an answer and save it to the answer bank.
 * Marks the applicationQuestion as approved with the final answer,
 * and creates a new entry in the answer bank.
 */
export const approveAndSaveAnswer = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      questionId: string;
      applicationId: string;
      finalAnswer: string;
      category: string;
      questionText: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    const candidate = await getCurrentCandidate(ctx);

    const sanitizedAnswer = sanitizeText(data.finalAnswer);
    const sanitizedQuestion = sanitizeText(data.questionText);

    // Update the applicationQuestion as approved
    await db
      .update(applicationQuestions)
      .set({
        finalAnswer: sanitizedAnswer,
        approved: true,
      })
      .where(eq(applicationQuestions.id, data.questionId));

    // Save to the answer bank
    const [bankEntry] = await db
      .insert(answerBank)
      .values({
        id: createId(),
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        questionPattern: sanitizedQuestion,
        category: data.category,
        answer: sanitizedAnswer,
        context: `Auto-saved from application ${data.applicationId}`,
        timesUsed: 1,
        lastUsed: new Date(),
      })
      .returning();

    return bankEntry;
  });

/**
 * Dismiss a question (mark it as reviewed without saving to bank).
 */
export const dismissQuestion = createServerFn({ method: 'POST' })
  .validator((data: { questionId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // Just clear out the suggested answer and mark as not approved
    await db
      .update(applicationQuestions)
      .set({
        suggestedAnswer: null,
        approved: false,
      })
      .where(eq(applicationQuestions.id, data.questionId));

    return { success: true };
  });
