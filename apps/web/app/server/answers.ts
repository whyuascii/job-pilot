import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { answerBank, candidates } from '@job-pilot/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';
import { sanitizeText } from '~/lib/sanitize';

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(
      eq(candidates.tenantId, ctx.tenantId),
      eq(candidates.userId, ctx.userId),
    ),
  });
  if (!candidate) throw new Error('No candidate profile found');
  return candidate;
}

export const listAnswers = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const answers = await db.query.answerBank.findMany({
    where: and(
      eq(answerBank.candidateId, candidate.id),
      eq(answerBank.tenantId, ctx.tenantId),
    ),
    orderBy: [asc(answerBank.category), desc(answerBank.updatedAt)],
  });

  return answers;
});

export const addAnswer = createServerFn({ method: 'POST' }).validator(
  (data: {
    questionPattern: string;
    category: string;
    answer: string;
    context?: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  // Sanitize free-text fields
  data.questionPattern = sanitizeText(data.questionPattern);
  data.answer = sanitizeText(data.answer);
  if (data.context) data.context = sanitizeText(data.context);

  const [answer] = await db
    .insert(answerBank)
    .values({
      candidateId: candidate.id,
      tenantId: ctx.tenantId,
      questionPattern: data.questionPattern,
      category: data.category,
      answer: data.answer,
      context: data.context ?? null,
    })
    .returning();

  return answer;
});

export const updateAnswer = createServerFn({ method: 'POST' }).validator(
  (data: {
    answerId: string;
    questionPattern?: string;
    category?: string;
    answer?: string;
    context?: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  // Sanitize free-text fields
  if (data.questionPattern) data.questionPattern = sanitizeText(data.questionPattern);
  if (data.answer) data.answer = sanitizeText(data.answer);
  if (data.context) data.context = sanitizeText(data.context);

  const { answerId, ...updates } = data;

  const [updated] = await db
    .update(answerBank)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(answerBank.id, answerId),
        eq(answerBank.candidateId, candidate.id),
      )
    )
    .returning();

  if (!updated) {
    throw new Error('Answer not found');
  }

  return updated;
});

export const deleteAnswer = createServerFn({ method: 'POST' }).validator(
  (data: { answerId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  await db
    .delete(answerBank)
    .where(
      and(
        eq(answerBank.id, data.answerId),
        eq(answerBank.candidateId, candidate.id),
      )
    );

  return { success: true };
});
