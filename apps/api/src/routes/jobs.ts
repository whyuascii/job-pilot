import {
  and,
  asc as ascFn,
  desc,
  desc as descFn,
  eq,
  getTableColumns,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { jobs, jobScores } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';
import { capture, captureError } from '../lib/posthog.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const router = Router();

// GET /api/jobs
router.get('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();

    // Parse query params with defaults
    const q = (req.query.q as string | undefined)?.trim() || undefined;
    const remote = req.query.remote
      ? (req.query.remote as string)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
    const recommendation = req.query.recommendation
      ? (req.query.recommendation as string)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const hasScore = req.query.hasScore as 'scored' | 'unscored' | undefined;
    const employmentType = req.query.employmentType
      ? (req.query.employmentType as string)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const minComp = req.query.minComp ? Number(req.query.minComp) : undefined;
    const maxComp = req.query.maxComp ? Number(req.query.maxComp) : undefined;
    const domain = (req.query.domain as string | undefined)?.trim() || undefined;
    const sponsorship = (req.query.sponsorship as string | undefined)?.trim() || undefined;
    const minYears = req.query.minYears ? Number(req.query.minYears) : undefined;
    const maxYears = req.query.maxYears ? Number(req.query.maxYears) : undefined;
    const postedAfter = (req.query.postedAfter as string | undefined)?.trim() || undefined;
    const sortBy = (req.query.sortBy as string) || 'score';
    const sortDir = (req.query.sortDir as string) || 'desc';
    const page = Math.max(1, req.query.page ? Number(req.query.page) : 1);
    const pageSize = Math.min(
      100,
      Math.max(1, req.query.pageSize ? Number(req.query.pageSize) : 50),
    );

    // Build conditions array
    const conditions: ReturnType<typeof eq>[] = [eq(jobs.tenantId, ctx.tenantId)];

    // Text search: OR across title, company, location, mustHaveSkills::text, niceToHaveSkills::text
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(jobs.title, pattern),
          ilike(jobs.company, pattern),
          ilike(jobs.location, pattern),
          sql`${jobs.mustHaveSkills}::text ILIKE ${pattern}`,
          sql`${jobs.niceToHaveSkills}::text ILIKE ${pattern}`,
        )!,
      );
    }

    // Remote policy filter
    if (remote && remote.length > 0) {
      conditions.push(inArray(jobs.remotePolicy, remote));
    }

    // Employment type filter
    if (employmentType && employmentType.length > 0) {
      conditions.push(inArray(jobs.employmentType, employmentType));
    }

    // Compensation filters
    if (minComp !== undefined && !isNaN(minComp)) {
      conditions.push(gte(jobs.compensationMin, minComp));
    }
    if (maxComp !== undefined && !isNaN(maxComp)) {
      conditions.push(lte(jobs.compensationMax, maxComp));
    }

    // Domain filter
    if (domain) {
      conditions.push(ilike(jobs.domain, `%${domain}%`));
    }

    // Sponsorship filter
    if (sponsorship) {
      conditions.push(eq(jobs.sponsorship, sponsorship));
    }

    // Years required filters
    if (minYears !== undefined && !isNaN(minYears)) {
      conditions.push(gte(jobs.yearsRequired, minYears));
    }
    if (maxYears !== undefined && !isNaN(maxYears)) {
      conditions.push(lte(jobs.yearsRequired, maxYears));
    }

    // Posted after filter
    if (postedAfter) {
      conditions.push(gte(jobs.createdAt, new Date(postedAfter)));
    }

    // Score-based filters (applied on the joined result)
    if (minScore !== undefined && !isNaN(minScore)) {
      conditions.push(gte(jobScores.overallScore, minScore));
    }

    if (recommendation && recommendation.length > 0) {
      conditions.push(inArray(jobScores.recommendation, recommendation));
    }

    if (hasScore === 'scored') {
      conditions.push(isNotNull(jobScores.id));
    } else if (hasScore === 'unscored') {
      conditions.push(isNull(jobScores.id));
    }

    // Build sort expression
    const sortDirFn = sortDir === 'asc' ? ascFn : descFn;
    let orderByExpr;
    switch (sortBy) {
      case 'date':
        orderByExpr = sortDirFn(jobs.createdAt);
        break;
      case 'company':
        orderByExpr = sortDirFn(jobs.company);
        break;
      case 'title':
        orderByExpr = sortDirFn(jobs.title);
        break;
      case 'score':
      default:
        orderByExpr = sortDirFn(sql`COALESCE(${jobScores.overallScore}, -1)`);
        break;
    }

    const offset = (page - 1) * pageSize;
    const whereClause = and(...conditions);

    // Count query for total
    const [{ count: total }] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(jobs)
      .leftJoin(jobScores, eq(jobScores.jobId, jobs.id))
      .where(whereClause);

    // Main query with join, filtering, sorting, and pagination
    const jobColumns = getTableColumns(jobs);
    const rows = await db
      .select({
        ...jobColumns,
        scoreId: jobScores.id,
        scoreJobId: jobScores.jobId,
        scoreCandidateId: jobScores.candidateId,
        fitScore: jobScores.fitScore,
        competitivenessScore: jobScores.competitivenessScore,
        overallScore: jobScores.overallScore,
        fitBreakdown: jobScores.fitBreakdown,
        competitivenessBreakdown: jobScores.competitivenessBreakdown,
        recommendation: jobScores.recommendation,
        reasoning: jobScores.reasoning,
        scoredAt: jobScores.scoredAt,
      })
      .from(jobs)
      .leftJoin(jobScores, eq(jobScores.jobId, jobs.id))
      .where(whereClause)
      .orderBy(orderByExpr)
      .limit(pageSize)
      .offset(offset);

    // Transform rows into job + score shape
    const items = rows.map((row) => {
      const {
        scoreId,
        scoreJobId,
        scoreCandidateId,
        fitScore,
        competitivenessScore,
        overallScore,
        fitBreakdown,
        competitivenessBreakdown,
        recommendation: rec,
        reasoning,
        scoredAt,
        ...jobFields
      } = row;

      const score = scoreId
        ? {
            id: scoreId,
            jobId: scoreJobId,
            candidateId: scoreCandidateId,
            fitScore,
            competitivenessScore,
            overallScore,
            fitBreakdown,
            competitivenessBreakdown,
            recommendation: rec,
            reasoning,
            scoredAt,
          }
        : null;

      return { ...jobFields, score };
    });

    res.json({ items, total, page, pageSize });
  } catch (e) {
    next(e);
  }
});

// GET /api/jobs/:jobId
router.get('/:jobId', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, req.params.jobId), eq(jobs.tenantId, ctx.tenantId)),
    });
    if (!job) throw new Error('Job not found');

    const score = await db.query.jobScores.findFirst({
      where: eq(jobScores.jobId, job.id),
    });

    res.json({ ...job, score: score ?? null });
  } catch (e) {
    next(e);
  }
});

// POST /api/jobs
router.post('/', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const data = req.body;
    const [job] = await db
      .insert(jobs)
      .values({
        id: createId(),
        tenantId: ctx.tenantId,
        company: data.company,
        title: data.title,
        location: data.location || '',
        remotePolicy: data.remotePolicy || 'unknown',
        compensationMin: data.compensationMin ?? null,
        compensationMax: data.compensationMax ?? null,
        compensationCurrency: data.compensationCurrency ?? null,
        compensationType: data.compensationType || 'salary',
        employmentType: data.employmentType || 'full_time',
        yearsRequired: data.yearsRequired ?? null,
        mustHaveSkills: data.mustHaveSkills || [],
        niceToHaveSkills: data.niceToHaveSkills || [],
        domain: data.domain ?? null,
        sponsorship: data.sponsorship || 'unknown',
        applyUrl: data.applyUrl ?? null,
        sourceUrl: data.sourceUrl ?? null,
        rawDescription: data.rawDescription || '',
        parsedDescription: data.parsedDescription || '',
      })
      .returning();
    capture(ctx.userId, 'job_created', { jobId: job.id, tenantId: ctx.tenantId });
    res.json(job);
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'job_created', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

// POST /api/jobs/delete
router.post('/delete', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { jobId } = req.body;
    await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.tenantId, ctx.tenantId)));
    capture(ctx.userId, 'job_deleted', { jobId, tenantId: ctx.tenantId });
    res.json({ success: true });
  } catch (e) {
    try {
      const ctx = getTenantContext();
      captureError(ctx.userId, 'job_deleted', e, { tenantId: ctx.tenantId });
    } catch {}
    next(e);
  }
});

export default router;
