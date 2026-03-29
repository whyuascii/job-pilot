import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { applications, jobs, jobScores, tailoredResumes } from '@job-pilot/db/schema';
import { eq, and, count, avg, desc, sql } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';

export type ActivityItem = {
  type: 'job_added' | 'application_created' | 'status_changed' | 'job_scored';
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, string>;
};

export type ScoreDistribution = {
  strongApply: number;
  apply: number;
  maybe: number;
  skip: number;
  avgFit: number;
  avgCompetitiveness: number;
};

export const getDashboardStats = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  // Try cache first (TTL: 5 min)
  const cacheKey = `dashboard:${ctx.tenantId}`;
  const { cacheGet, cacheSet } = await import('~/lib/cache');
  const cached = await cacheGet<ReturnType<typeof getDashboardStats> extends Promise<infer R> ? R : never>(cacheKey);
  if (cached) return cached;

  // Count active applications (not rejected or withdrawn)
  const activeApps = await db
    .select({ count: count() })
    .from(applications)
    .where(
      and(
        eq(applications.tenantId, ctx.tenantId),
        sql`${applications.status} NOT IN ('rejected', 'withdrawn')`,
      )
    );

  // Count total jobs
  const totalJobs = await db
    .select({ count: count() })
    .from(jobs)
    .where(eq(jobs.tenantId, ctx.tenantId));

  // Count jobs with strong_apply or apply recommendation
  const shortlistedJobs = await db
    .select({ count: count() })
    .from(jobScores)
    .innerJoin(jobs, eq(jobScores.jobId, jobs.id))
    .where(
      and(
        eq(jobs.tenantId, ctx.tenantId),
        sql`${jobScores.recommendation} IN ('strong_apply', 'apply')`,
      )
    );

  // Count tailored resumes
  const resumeCount = await db
    .select({ count: count() })
    .from(tailoredResumes)
    .where(eq(tailoredResumes.tenantId, ctx.tenantId));

  // Calculate interview rate (applications that made it past 'applied')
  const interviewStages = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];
  const appliedCount = await db
    .select({ count: count() })
    .from(applications)
    .where(
      and(
        eq(applications.tenantId, ctx.tenantId),
        sql`${applications.status} != 'discovered'`,
        sql`${applications.status} != 'shortlisted'`,
        sql`${applications.status} != 'resume_generated'`,
      )
    );

  const interviewCount = await db
    .select({ count: count() })
    .from(applications)
    .where(
      and(
        eq(applications.tenantId, ctx.tenantId),
        sql`${applications.status} IN (${sql.join(interviewStages.map(s => sql`${s}`), sql`, `)})`,
      )
    );

  const totalApplied = appliedCount[0]?.count ?? 0;
  const totalInterviews = interviewCount[0]?.count ?? 0;
  const successRate = totalApplied > 0
    ? Math.round((totalInterviews / totalApplied) * 100)
    : 0;

  // --- Recent Activity ---
  // Recent jobs added
  const recentJobs = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(eq(jobs.tenantId, ctx.tenantId))
    .orderBy(desc(jobs.createdAt))
    .limit(5);

  // Recent applications created
  const recentApps = await db
    .select({
      id: applications.id,
      status: applications.status,
      createdAt: applications.createdAt,
      jobTitle: jobs.title,
      company: jobs.company,
    })
    .from(applications)
    .innerJoin(jobs, eq(applications.jobId, jobs.id))
    .where(eq(applications.tenantId, ctx.tenantId))
    .orderBy(desc(applications.createdAt))
    .limit(5);

  // Recent scores
  const recentScores = await db
    .select({
      id: jobScores.id,
      jobId: jobScores.jobId,
      recommendation: jobScores.recommendation,
      overallScore: jobScores.overallScore,
      scoredAt: jobScores.scoredAt,
      jobTitle: jobs.title,
      company: jobs.company,
    })
    .from(jobScores)
    .innerJoin(jobs, eq(jobScores.jobId, jobs.id))
    .where(eq(jobs.tenantId, ctx.tenantId))
    .orderBy(desc(jobScores.scoredAt))
    .limit(5);

  // Build activity items
  const activityItems: ActivityItem[] = [];

  for (const job of recentJobs) {
    activityItems.push({
      type: 'job_added',
      title: `New job added`,
      description: `${job.title} at ${job.company}`,
      timestamp: job.createdAt.toISOString(),
      metadata: { jobId: job.id },
    });
  }

  for (const app of recentApps) {
    activityItems.push({
      type: 'application_created',
      title: `Application created`,
      description: `${app.jobTitle} at ${app.company}`,
      timestamp: app.createdAt.toISOString(),
      metadata: { applicationId: app.id },
    });
  }

  for (const score of recentScores) {
    const recLabel = score.recommendation.replace('_', ' ');
    activityItems.push({
      type: 'job_scored',
      title: `Job scored`,
      description: `${score.jobTitle} at ${score.company} — ${recLabel} (${Math.round(score.overallScore * 100)}%)`,
      timestamp: score.scoredAt.toISOString(),
      metadata: { jobId: score.jobId, scoreId: score.id },
    });
  }

  // Sort by timestamp descending and take top 10
  activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivity = activityItems.slice(0, 10);

  // --- Score Distribution ---
  const recCounts = await db
    .select({
      recommendation: jobScores.recommendation,
      count: count(),
    })
    .from(jobScores)
    .innerJoin(jobs, eq(jobScores.jobId, jobs.id))
    .where(eq(jobs.tenantId, ctx.tenantId))
    .groupBy(jobScores.recommendation);

  const recMap: Record<string, number> = {};
  for (const row of recCounts) {
    recMap[row.recommendation] = row.count;
  }

  const avgScores = await db
    .select({
      avgFit: avg(jobScores.fitScore),
      avgComp: avg(jobScores.competitivenessScore),
    })
    .from(jobScores)
    .innerJoin(jobs, eq(jobScores.jobId, jobs.id))
    .where(eq(jobs.tenantId, ctx.tenantId));

  const scoreDistribution: ScoreDistribution = {
    strongApply: recMap['strong_apply'] ?? 0,
    apply: recMap['apply'] ?? 0,
    maybe: recMap['maybe'] ?? 0,
    skip: recMap['skip'] ?? 0,
    avgFit: avgScores[0]?.avgFit ? parseFloat(String(avgScores[0].avgFit)) : 0,
    avgCompetitiveness: avgScores[0]?.avgComp ? parseFloat(String(avgScores[0].avgComp)) : 0,
  };

  const result = {
    activeFlights: activeApps[0]?.count ?? 0,
    targetsAcquired: shortlistedJobs[0]?.count ?? 0,
    resumesDeployed: resumeCount[0]?.count ?? 0,
    successRate,
    totalJobs: totalJobs[0]?.count ?? 0,
    recentActivity,
    scoreDistribution,
  };

  await cacheSet(cacheKey, result, 300); // 5 min TTL

  return result;
});
