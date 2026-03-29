import { Router } from 'express';
import { db } from '@job-pilot/db';
import { flightRecords, jobs, applications, jobScores, candidates } from '@job-pilot/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getTenantContext } from '../lib/context.js';

const router = Router();

// List all flight records for tenant.
// Returns a unified list: formal flight records + applications without one.
router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) {
      res.json([]);
      return;
    }

    // Get all flight records
    const records = await db.query.flightRecords.findMany({
      where: eq(flightRecords.tenantId, ctx.tenantId),
      orderBy: [desc(flightRecords.createdAt)],
    });

    // Get all applications
    const allApps = await db.query.applications.findMany({
      where: eq(applications.tenantId, ctx.tenantId),
      orderBy: [desc(applications.updatedAt)],
    });

    // Build a set of applicationIds that already have flight records
    const appIdsWithRecords = new Set(records.map(r => r.applicationId));

    // Fetch all relevant jobs in one query
    const allJobIds = [...new Set([
      ...records.map(r => r.jobId),
      ...allApps.map(a => a.jobId),
    ])];
    const jobList = allJobIds.length > 0
      ? await db.query.jobs.findMany({
          where: eq(jobs.tenantId, ctx.tenantId),
        }).then(all => all.filter(j => allJobIds.includes(j.id)))
      : [];
    const jobMap = Object.fromEntries(jobList.map(j => [j.id, j]));

    // Fetch scores for applications without flight records
    const appsWithoutRecords = allApps.filter(a => !appIdsWithRecords.has(a.id));
    const scoreList = appsWithoutRecords.length > 0
      ? await db.query.jobScores.findMany({
          where: eq(jobScores.candidateId, candidate.id),
        }).then(all => all.filter(s => appsWithoutRecords.some(a => a.jobId === s.jobId)))
      : [];
    const scoreMap = Object.fromEntries(scoreList.map(s => [s.jobId, s]));

    // Build unified list: flight records first
    const result: any[] = records.map(r => ({
      id: r.id,
      applicationId: r.applicationId,
      jobId: r.jobId,
      jobTitle: jobMap[r.jobId]?.title ?? (r.jobSnapshot as any)?.title ?? 'Unknown',
      jobCompany: jobMap[r.jobId]?.company ?? (r.jobSnapshot as any)?.company ?? 'Unknown',
      scoreSnapshot: r.scoreSnapshot,
      jobSnapshot: r.jobSnapshot,
      resumeSnapshot: r.resumeSnapshot,
      coverLetterSnapshot: r.coverLetterSnapshot,
      appliedAt: r.appliedAt,
      createdAt: r.createdAt,
      hasFlightRecord: true,
    }));

    // Then add applications without flight records
    for (const app of appsWithoutRecords) {
      const job = jobMap[app.jobId];
      const score = scoreMap[app.jobId];
      result.push({
        id: `app_${app.id}`,
        applicationId: app.id,
        jobId: app.jobId,
        jobTitle: job?.title ?? 'Unknown',
        jobCompany: job?.company ?? 'Unknown',
        scoreSnapshot: score ? {
          overallScore: score.overallScore,
          fitScore: score.fitScore,
          competitivenessScore: score.competitivenessScore,
          recommendation: score.recommendation,
        } : null,
        jobSnapshot: job ? {
          title: job.title,
          company: job.company,
          location: job.location,
          mustHaveSkills: (job.mustHaveSkills as string[]) ?? [],
        } : null,
        resumeSnapshot: null,
        coverLetterSnapshot: null,
        appliedAt: app.appliedAt,
        createdAt: app.createdAt,
        status: app.status,
        hasFlightRecord: false,
      });
    }

    // Sort by most recent first
    result.sort((a, b) => {
      const dateA = new Date(a.appliedAt || a.createdAt).getTime();
      const dateB = new Date(b.appliedAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    res.json(result);
  } catch (e) { next(e); }
});

// Get single flight record with full snapshots
router.get('/:id', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const record = await db.query.flightRecords.findFirst({
      where: and(eq(flightRecords.id, req.params.id), eq(flightRecords.tenantId, ctx.tenantId)),
    });
    if (!record) throw new Error('Flight record not found');

    const job = await db.query.jobs.findFirst({ where: eq(jobs.id, record.jobId), columns: { id: true, title: true, company: true } });

    res.json({
      ...record,
      jobTitle: job?.title ?? 'Unknown',
      jobCompany: job?.company ?? 'Unknown',
    });
  } catch (e) { next(e); }
});

export default router;
