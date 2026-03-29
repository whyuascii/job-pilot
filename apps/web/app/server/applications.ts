import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { applications, jobs, jobScores, outcomes } from '@job-pilot/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';
import { sanitizeText } from '~/lib/sanitize';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

export const listApplications = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const appList = await db.query.applications.findMany({
    where: eq(applications.tenantId, ctx.tenantId),
    orderBy: [desc(applications.updatedAt)],
    limit: 100,
    with: {
      // Note: relations need to be defined in Drizzle schema for this to work
      // For now, we'll join manually
    },
  });

  // Get associated job info for each application
  const enrichedApps = await Promise.all(
    appList.map(async (app) => {
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, app.jobId),
      });
      return {
        ...app,
        job: job ?? null,
      };
    })
  );

  return enrichedApps;
});

export const getApplication = createServerFn({ method: 'GET' }).validator(
  (data: { applicationId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  const app = await db.query.applications.findFirst({
    where: and(
      eq(applications.id, data.applicationId),
      eq(applications.tenantId, ctx.tenantId),
    ),
  });

  if (!app) {
    throw new Error('Application not found');
  }

  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, app.jobId),
  });

  const score = job
    ? await db.query.jobScores.findFirst({
        where: eq(jobScores.jobId, job.id),
      })
    : null;

  return {
    ...app,
    job: job ? { ...job, score: score ?? null } : null,
  };
});

export const createApplication = createServerFn({ method: 'POST' }).validator(
  (data: { jobId: string; status?: string; notes?: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  // Sanitize free-text fields
  if (data.notes) data.notes = sanitizeText(data.notes);

  // Get the candidate for this user
  const candidate = await db.query.candidates.findFirst({
    where: and(
      eq((await import('@job-pilot/db/schema')).candidates.tenantId, ctx.tenantId),
      eq((await import('@job-pilot/db/schema')).candidates.userId, ctx.userId),
    ),
  });

  if (!candidate) {
    throw new Error('No candidate profile found. Please create your profile first.');
  }

  const [app] = await db
    .insert(applications)
    .values({
      jobId: data.jobId,
      candidateId: candidate.id,
      tenantId: ctx.tenantId,
      status: data.status ?? 'discovered',
      notes: data.notes ?? '',
    })
    .returning();

  return app;
});

export const updateApplicationStatus = createServerFn({ method: 'POST' }).validator(
  (data: { applicationId: string; status: string; notes?: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  const [updated] = await db
    .update(applications)
    .set({
      status: data.status,
      notes: data.notes !== undefined ? data.notes : undefined,
      updatedAt: new Date(),
      ...(data.status === 'applied' ? { appliedAt: new Date() } : {}),
    })
    .where(
      and(
        eq(applications.id, data.applicationId),
        eq(applications.tenantId, ctx.tenantId),
      )
    )
    .returning();

  if (!updated) {
    throw new Error('Application not found');
  }

  // Record an outcome entry for the status change
  await db.insert(outcomes).values({
    id: createId(),
    applicationId: data.applicationId,
    stage: data.status,
    notes: data.notes ?? null,
  });

  return updated;
});
