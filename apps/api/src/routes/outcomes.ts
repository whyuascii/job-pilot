import { and, desc, eq } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '@job-pilot/db';
import { applications, outcomes } from '@job-pilot/db/schema';

import { getTenantContext } from '../lib/context.js';
import { capture } from '../lib/posthog.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const router = Router();

// POST /api/outcomes/list
router.post('/list', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { applicationId } = req.body;

    const app = await db.query.applications.findFirst({
      where: and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)),
    });
    if (!app) throw new Error('Application not found');

    const list = await db.query.outcomes.findMany({
      where: eq(outcomes.applicationId, applicationId),
      orderBy: [desc(outcomes.occurredAt)],
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

// POST /api/outcomes
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { applicationId, stage, notes } = req.body;

    const app = await db.query.applications.findFirst({
      where: and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)),
    });
    if (!app) throw new Error('Application not found');

    const [outcome] = await db
      .insert(outcomes)
      .values({
        id: createId(),
        applicationId,
        stage,
        notes: notes || '',
      })
      .returning();
    capture(ctx.userId, 'outcome_recorded', { tenantId: ctx.tenantId, stage });
    res.json(outcome);
  } catch (e) {
    next(e);
  }
});

export default router;
