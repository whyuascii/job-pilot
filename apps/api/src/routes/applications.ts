import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import {
  applications,
  candidates,
  coverLetters,
  flightRecords,
  jobs,
  jobScores,
  outcomes,
} from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const router = Router();

// GET /api/applications
router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const appList = await db.query.applications.findMany({
      where: eq(applications.tenantId, ctx.tenantId),
      orderBy: [desc(applications.updatedAt)],
    });

    const enriched = await Promise.all(
      appList.map(async (app) => {
        const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
        const score = await db.query.jobScores.findFirst({
          where: and(eq(jobScores.jobId, app.jobId), eq(jobScores.candidateId, app.candidateId)),
        });
        return { ...app, job, score };
      }),
    );

    res.json(enriched);
  } catch (e) {
    next(e);
  }
});

// GET /api/applications/:applicationId
router.get('/:applicationId', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const app = await db.query.applications.findFirst({
      where: and(
        eq(applications.id, req.params.applicationId),
        eq(applications.tenantId, ctx.tenantId),
      ),
    });
    if (!app) throw new Error('Application not found');

    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, app.jobId) });
    const score = await db.query.jobScores.findFirst({
      where: and(eq(jobScores.jobId, app.jobId), eq(jobScores.candidateId, app.candidateId)),
    });

    res.json({ ...app, job, score });
  } catch (e) {
    next(e);
  }
});

// POST /api/applications
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId } = req.body;

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found.');

    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.jobId, jobId),
        eq(applications.candidateId, candidate.id),
        eq(applications.tenantId, ctx.tenantId),
      ),
    });
    if (existing) throw new Error('You have already applied to this job.');

    const [app] = await db
      .insert(applications)
      .values({
        id: createId(),
        jobId,
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        status: 'applied',
        appliedAt: new Date(),
      })
      .returning();

    await db.insert(outcomes).values({
      id: createId(),
      applicationId: app.id,
      stage: 'applied',
      notes: 'Application submitted',
    });

    capture(ctx.userId, 'application_created', {
      applicationId: app.id,
      jobId,
      tenantId: ctx.tenantId,
    });
    res.json(app);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'application_created', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

// POST /api/applications/update-status
router.post('/update-status', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { applicationId, status } = req.body;

    // Read current status for analytics tracking
    const current = await db.query.applications.findFirst({
      where: and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)),
      columns: { status: true },
    });
    const previousStatus = current?.status ?? 'unknown';

    const [updated] = await db
      .update(applications)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) throw new Error('Application not found');

    await db.insert(outcomes).values({
      id: createId(),
      applicationId,
      stage: status,
      notes: `Status changed to ${status}`,
    });

    capture(ctx.userId, 'application_status_updated', {
      applicationId,
      from: previousStatus,
      to: status,
      tenantId: ctx.tenantId,
    });
    res.json(updated);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'application_status_updated', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

// POST /api/applications/mark-applied
router.post('/mark-applied', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId } = req.body;
    if (!jobId) throw new Error('jobId is required');

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found.');

    // Find or create application
    let app = await db.query.applications.findFirst({
      where: and(
        eq(applications.jobId, jobId),
        eq(applications.candidateId, candidate.id),
        eq(applications.tenantId, ctx.tenantId),
      ),
    });

    const now = new Date();
    if (app) {
      [app] = await db
        .update(applications)
        .set({ status: 'applied', appliedAt: now, updatedAt: now })
        .where(eq(applications.id, app.id))
        .returning();
    } else {
      [app] = await db
        .insert(applications)
        .values({
          id: createId(),
          jobId,
          candidateId: candidate.id,
          tenantId: ctx.tenantId,
          status: 'applied',
          appliedAt: now,
        })
        .returning();

      await db.insert(outcomes).values({
        id: createId(),
        applicationId: app.id,
        stage: 'applied',
        notes: 'Marked as applied via Application Assist',
      });
    }

    // Build flight record snapshot
    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
    const score = await db.query.jobScores.findFirst({
      where: and(eq(jobScores.jobId, jobId), eq(jobScores.candidateId, candidate.id)),
    });
    const coverLetter = await db.query.coverLetters.findFirst({
      where: and(eq(coverLetters.jobId, jobId), eq(coverLetters.tenantId, ctx.tenantId)),
    });

    // Try to get tailored resume
    let resumeSnapshot: any = { summary: 'No tailored resume at time of application' };
    try {
      const { tailoredResumes } = await import('@job-pilot/db/schema');
      const tailored = await db.query.tailoredResumes?.findFirst({
        where: and(eq(tailoredResumes.jobId, jobId), eq(tailoredResumes.candidateId, candidate.id)),
      });
      if (tailored) resumeSnapshot = tailored.contentJson;
    } catch {}

    const [flightRecord] = await db
      .insert(flightRecords)
      .values({
        id: createId(),
        applicationId: app.id,
        candidateId: candidate.id,
        jobId,
        tenantId: ctx.tenantId,
        resumeSnapshot,
        coverLetterSnapshot: coverLetter?.content ?? null,
        jobSnapshot: job
          ? {
              title: job.title,
              company: job.company,
              location: job.location,
              mustHaveSkills: (job.mustHaveSkills as string[]) ?? [],
            }
          : { title: 'Unknown', company: 'Unknown' },
        scoreSnapshot: score
          ? {
              overallScore: score.overallScore,
              fitScore: score.fitScore,
              competitivenessScore: score.competitivenessScore,
              recommendation: score.recommendation,
            }
          : null,
        appliedAt: now,
      })
      .returning();

    capture(ctx.userId, 'application_marked_applied', {
      applicationId: app.id,
      jobId,
      tenantId: ctx.tenantId,
    });
    res.json({ application: app, flightRecordId: flightRecord.id });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'application_marked_applied', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

// POST /api/applications/delete
router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { applicationId } = req.body;

    // Delete related outcomes first
    await db.delete(outcomes).where(eq(outcomes.applicationId, applicationId));

    // Delete the application
    await db
      .delete(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)));

    capture(ctx.userId, 'application_deleted', { applicationId, tenantId: ctx.tenantId });
    res.json({ success: true });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'application_deleted', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

// POST /api/applications/quick-add
router.post('/quick-add', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const {
      company,
      jobTitle,
      dateApplied,
      compMin,
      compMax,
      equityDetails,
      source,
      status,
      statusNote,
    } = req.body;

    if (!company || typeof company !== 'string' || !company.trim()) {
      res.status(400).json({ error: 'company is required' });
      return;
    }

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found.');

    const now = new Date();
    const appliedAt = dateApplied ? new Date(dateApplied) : now;
    const appStatus = status || 'applied';

    // Create a minimal job stub
    const [job] = await db
      .insert(jobs)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        title: jobTitle?.trim() || 'Not specified',
        company: company.trim(),
        location: '',
        applyUrl: '',
        sourceUrl: '',
        rawDescription: '',
      })
      .returning();

    // Create the application
    const [app] = await db
      .insert(applications)
      .values({
        id: createId(),
        jobId: job.id,
        candidateId: candidate.id,
        tenantId: ctx.tenantId,
        status: appStatus,
        appliedAt,
        lastActivityAt: now,
        compMin: compMin ?? null,
        compMax: compMax ?? null,
        equityDetails: equityDetails ?? null,
        source: source || 'manual',
        statusNote: statusNote ?? null,
      })
      .returning();

    // Create an outcome record
    await db.insert(outcomes).values({
      id: createId(),
      applicationId: app.id,
      stage: appStatus,
      notes: 'Quick-added from Control Tower',
    });

    capture(ctx.userId, 'application_quick_added', {
      applicationId: app.id,
      jobId: job.id,
      tenantId: ctx.tenantId,
    });
    res.json({ ...app, job });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'application_quick_added', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

// POST /api/applications/update-details
router.post('/update-details', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const {
      applicationId,
      compMin,
      compMax,
      equityDetails,
      compNotes,
      subStatus,
      statusNote,
      declinedByUser,
    } = req.body;

    if (!applicationId) {
      res.status(400).json({ error: 'applicationId is required' });
      return;
    }

    const now = new Date();
    const updates: Record<string, any> = {
      lastActivityAt: now,
      updatedAt: now,
    };

    if (compMin !== undefined) updates.compMin = compMin;
    if (compMax !== undefined) updates.compMax = compMax;
    if (equityDetails !== undefined) updates.equityDetails = equityDetails;
    if (compNotes !== undefined) updates.compNotes = compNotes;
    if (subStatus !== undefined) updates.subStatus = subStatus;
    if (statusNote !== undefined) updates.statusNote = statusNote;

    if (declinedByUser === true) {
      updates.declinedByUser = true;
      updates.status = 'withdrawn';
    } else if (declinedByUser === false) {
      updates.declinedByUser = false;
    }

    const [updated] = await db
      .update(applications)
      .set(updates)
      .where(and(eq(applications.id, applicationId), eq(applications.tenantId, ctx.tenantId)))
      .returning();

    if (!updated) throw new Error('Application not found');

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
