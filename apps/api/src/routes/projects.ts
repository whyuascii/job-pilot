import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, projects } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';

const router = Router();

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found.');
  return candidate;
}

// GET /api/projects
router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const list = await db.query.projects.findMany({
      where: eq(projects.candidateId, candidate.id),
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// POST /api/projects
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const data = req.body;
    const [project] = await db
      .insert(projects)
      .values({
        candidateId: candidate.id,
        name: data.name,
        description: data.description || '',
        url: data.url ?? null,
        skills: data.skills || [],
        highlights: data.highlights || [],
      })
      .returning();
    res.json(project);
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/update
router.post('/update', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { projectId, ...data } = req.body;
    const [updated] = await db
      .update(projects)
      .set(data)
      .where(and(eq(projects.id, projectId), eq(projects.candidateId, candidate.id)))
      .returning();
    if (!updated) throw new Error('Project not found');
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/delete
router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const candidate = await getCurrentCandidate(ctx);
    const { projectId } = req.body;
    await db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.candidateId, candidate.id)));
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
