import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { answerBank, candidates } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { capture } from '../lib/posthog.js';
import { sanitizeText } from '../lib/sanitize.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const router = Router();

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found.');
  return candidate;
}

router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const list = await db.query.answerBank.findMany({
      where: and(eq(answerBank.candidateId, candidate.id), eq(answerBank.tenantId, ctx.tenantId)),
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const data = req.body;
    const [answer] = await db
      .insert(answerBank)
      .values({
        id: createId(),
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        questionPattern: sanitizeText(data.questionPattern),
        answer: sanitizeText(data.answer),
        category: data.category || 'general',
        context: data.context || '',
        timesUsed: 0,
      })
      .returning();
    capture(ctx.userId, 'answer_created', { tenantId: ctx.tenantId });
    res.json(answer);
  } catch (e) {
    next(e);
  }
});

router.post('/update', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { answerId, ...data } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (data.questionPattern) updateData.questionPattern = sanitizeText(data.questionPattern);
    if (data.answer) updateData.answer = sanitizeText(data.answer);
    if (data.category) updateData.category = data.category;
    if (data.context !== undefined) updateData.context = data.context;
    const [updated] = await db
      .update(answerBank)
      .set(updateData)
      .where(and(eq(answerBank.id, answerId), eq(answerBank.candidateId, candidate.id)))
      .returning();
    if (!updated) throw new Error('Answer not found');
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { answerId } = req.body;
    await db
      .delete(answerBank)
      .where(and(eq(answerBank.id, answerId), eq(answerBank.candidateId, candidate.id)));
    capture(ctx.userId, 'answer_deleted', { tenantId: ctx.tenantId });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
