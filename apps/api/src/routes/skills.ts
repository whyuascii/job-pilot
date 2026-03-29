import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, skills } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';

const router = Router();

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found.');
  return candidate;
}

// GET /api/skills
router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const list = await db.query.skills.findMany({
      where: eq(skills.candidateId, candidate.id),
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// POST /api/skills
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const data = req.body;
    const [skill] = await db
      .insert(skills)
      .values({
        candidateId: candidate.id,
        name: data.name,
        category: data.category || 'tool',
        confidenceScore: data.confidenceScore ?? 50,
        yearsUsed: data.yearsUsed ?? null,
      })
      .returning();
    res.json(skill);
  } catch (e) {
    next(e);
  }
});

// POST /api/skills/update
router.post('/update', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { skillId, ...data } = req.body;
    const [updated] = await db
      .update(skills)
      .set(data)
      .where(and(eq(skills.id, skillId), eq(skills.candidateId, candidate.id)))
      .returning();
    if (!updated) throw new Error('Skill not found');
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/skills/delete
router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { skillId } = req.body;
    await db
      .delete(skills)
      .where(and(eq(skills.id, skillId), eq(skills.candidateId, candidate.id)));
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/skills/bulk
router.post('/bulk', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { skills: skillsData } = req.body;
    const values = skillsData.map((s: any) => ({
      candidateId: candidate.id,
      name: s.name,
      category: s.category || 'tool',
      confidenceScore: s.confidenceScore ?? 50,
      yearsUsed: s.yearsUsed ?? null,
    }));
    const result = await db.insert(skills).values(values).returning();
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
