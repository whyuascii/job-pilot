import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, experienceBlocks } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { capture } from '../lib/posthog.js';

const router = Router();

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found.');
  return candidate;
}

// GET /api/experience
router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const list = await db.query.experienceBlocks.findMany({
      where: eq(experienceBlocks.candidateId, candidate.id),
      orderBy: [desc(experienceBlocks.startDate)],
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// POST /api/experience
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const data = req.body;
    const [exp] = await db
      .insert(experienceBlocks)
      .values({
        candidateId: candidate.id,
        company: data.company,
        title: data.title,
        location: data.location || '',
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        current: data.current ?? false,
        description: data.description || '',
        bullets: data.bullets || [],
        skills: data.skills || [],
      })
      .returning();
    capture(ctx.userId, 'experience_added', { tenantId: ctx.tenantId });
    res.json(exp);
  } catch (e) {
    next(e);
  }
});

// POST /api/experience/update
router.post('/update', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { experienceId, ...data } = req.body;
    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    const [updated] = await db
      .update(experienceBlocks)
      .set(updateData)
      .where(
        and(eq(experienceBlocks.id, experienceId), eq(experienceBlocks.candidateId, candidate.id)),
      )
      .returning();
    if (!updated) throw new Error('Experience not found');
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/experience/delete
router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { experienceId } = req.body;
    await db
      .delete(experienceBlocks)
      .where(
        and(eq(experienceBlocks.id, experienceId), eq(experienceBlocks.candidateId, candidate.id)),
      );
    capture(ctx.userId, 'experience_deleted', { tenantId: ctx.tenantId });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
