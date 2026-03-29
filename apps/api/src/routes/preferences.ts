import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, preferences } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';

const router = Router();

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found.');
  return candidate;
}

router.get('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const category = req.query.category as string | undefined;
    const conditions = [eq(preferences.candidateId, candidate.id)];
    if (category) {
      conditions.push(eq(preferences.category, category));
    }
    const list = await db.query.preferences.findMany({
      where: and(...conditions),
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
    const [pref] = await db
      .insert(preferences)
      .values({
        candidateId: candidate.id,
        key: data.key,
        value: data.value,
        category: data.category || 'general',
      })
      .returning();
    res.json(pref);
  } catch (e) {
    next(e);
  }
});

router.post('/update', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { preferenceId, ...data } = req.body;
    const [updated] = await db
      .update(preferences)
      .set(data)
      .where(and(eq(preferences.id, preferenceId), eq(preferences.candidateId, candidate.id)))
      .returning();
    if (!updated) throw new Error('Preference not found');
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { preferenceId } = req.body;
    await db
      .delete(preferences)
      .where(and(eq(preferences.id, preferenceId), eq(preferences.candidateId, candidate.id)));
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
