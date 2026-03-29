import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { jobs, jobScores } from '@job-pilot/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';
import { sanitizeText } from '~/lib/sanitize';

export const listJobs = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const jobList = await db.query.jobs.findMany({
    where: eq(jobs.tenantId, ctx.tenantId),
    orderBy: [desc(jobs.createdAt)],
    limit: 500,
  });

  // Get scores for all jobs
  const jobIds = jobList.map(j => j.id);
  const scores = jobIds.length > 0
    ? await db.query.jobScores.findMany({
        where: sql`${jobScores.jobId} IN (${sql.join(jobIds.map(id => sql`${id}`), sql`, `)})`,
      })
    : [];

  const scoreMap = new Map(scores.map(s => [s.jobId, s]));

  return jobList.map(job => ({
    ...job,
    score: scoreMap.get(job.id) ?? null,
  }));
});

export const getJob = createServerFn({ method: 'GET' }).validator(
  (data: { jobId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, data.jobId), eq(jobs.tenantId, ctx.tenantId)),
  });

  if (!job) {
    throw new Error('Job not found');
  }

  const score = await db.query.jobScores.findFirst({
    where: eq(jobScores.jobId, job.id),
  });

  return { ...job, score: score ?? null };
});

export const createJob = createServerFn({ method: 'POST' }).validator(
  (data: {
    company: string;
    title: string;
    location: string;
    remotePolicy?: string;
    compensationMin?: number | null;
    compensationMax?: number | null;
    compensationCurrency?: string | null;
    compensationType?: string;
    employmentType?: string;
    yearsRequired?: number | null;
    mustHaveSkills?: string[];
    niceToHaveSkills?: string[];
    domain?: string | null;
    sponsorship?: string;
    applyUrl: string;
    sourceUrl: string;
    rawDescription: string;
    parsedDescription?: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  // Sanitize free-text fields
  data.company = sanitizeText(data.company);
  data.title = sanitizeText(data.title);
  data.location = sanitizeText(data.location);
  data.rawDescription = sanitizeText(data.rawDescription);

  const [job] = await db
    .insert(jobs)
    .values({
      ...data,
      tenantId: ctx.tenantId,
      mustHaveSkills: data.mustHaveSkills ?? [],
      niceToHaveSkills: data.niceToHaveSkills ?? [],
    })
    .returning();

  return job;
});

export const deleteJob = createServerFn({ method: 'POST' }).validator(
  (data: { jobId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  await db
    .delete(jobs)
    .where(and(eq(jobs.id, data.jobId), eq(jobs.tenantId, ctx.tenantId)));

  return { success: true };
});
