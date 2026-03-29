import {
  and,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lte,
  min,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import {
  applications,
  candidates,
  jobs,
  jobScores,
  outcomes,
  recruiterMessages,
  tailoredResumes,
} from '@job-pilot/db/schema';
import { cacheGet, cacheSet } from '../lib/cache.js';
import { getTenantContext } from '../lib/context.js';
import { capture } from '../lib/posthog.js';

const TERMINAL_STATUSES = ['rejected', 'withdrawn', 'accepted', 'offer_declined'];
const INTERVIEW_STAGES = ['interview', 'phone_screen', 'final_round', 'offer', 'accepted'];

// Status groupings for Control Tower
const PENDING_STATUSES = ['discovered', 'shortlisted', 'resume_generated', 'applied'];
const IN_PROGRESS_STATUSES = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];
const INACTIVE_STATUSES = ['rejected', 'withdrawn', 'accepted', 'offer_declined'];

// Funnel stage mapping
const FUNNEL_APPLIED_STATUSES = ['applied', 'resume_generated'];
const FUNNEL_SCREEN_STATUSES = ['recruiter_screen'];
const FUNNEL_INTERVIEW_STATUSES = ['technical', 'onsite', 'final'];
const FUNNEL_OFFER_STATUSES = ['offer', 'accepted'];

const GHOSTED_THRESHOLD_DAYS = 14;

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats  (original endpoint — kept as-is)
// ---------------------------------------------------------------------------
router.get('/stats', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const cacheKey = `dashboard:${ctx.tenantId}:stats`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      jobCount,
      totalAppCount,
      activeAppCount,
      interviewAppCount,
      tailoredCount,
      recentJobs,
      appStatuses,
      scoreRows,
      recentOutcomes,
    ] = await Promise.all([
      db.select({ count: count() }).from(jobs).where(eq(jobs.tenantId, ctx.tenantId)),
      db
        .select({ count: count() })
        .from(applications)
        .where(eq(applications.tenantId, ctx.tenantId)),
      db
        .select({ count: count() })
        .from(applications)
        .where(
          and(
            eq(applications.tenantId, ctx.tenantId),
            notInArray(applications.status, TERMINAL_STATUSES),
          ),
        ),
      db
        .select({ count: count() })
        .from(outcomes)
        .innerJoin(applications, eq(outcomes.applicationId, applications.id))
        .where(
          and(
            eq(applications.tenantId, ctx.tenantId),
            sql`${outcomes.stage} = ANY(ARRAY['interview', 'phone_screen', 'final_round', 'offer', 'accepted'])`,
          ),
        ),
      db
        .select({ count: count() })
        .from(tailoredResumes)
        .where(eq(tailoredResumes.tenantId, ctx.tenantId)),
      db.query.jobs.findMany({
        where: and(eq(jobs.tenantId, ctx.tenantId), gte(jobs.createdAt, sevenDaysAgo)),
        orderBy: [desc(jobs.createdAt)],
        limit: 10,
      }),
      db
        .select({ status: applications.status, count: count() })
        .from(applications)
        .where(eq(applications.tenantId, ctx.tenantId))
        .groupBy(applications.status),
      db
        .select({
          overallScore: jobScores.overallScore,
          fitScore: jobScores.fitScore,
          competitivenessScore: jobScores.competitivenessScore,
          recommendation: jobScores.recommendation,
        })
        .from(jobScores)
        .innerJoin(jobs, eq(jobScores.jobId, jobs.id))
        .where(eq(jobs.tenantId, ctx.tenantId)),
      db
        .select({
          id: outcomes.id,
          stage: outcomes.stage,
          notes: outcomes.notes,
          occurredAt: outcomes.occurredAt,
          applicationId: outcomes.applicationId,
        })
        .from(outcomes)
        .innerJoin(applications, eq(outcomes.applicationId, applications.id))
        .where(eq(applications.tenantId, ctx.tenantId))
        .orderBy(desc(outcomes.occurredAt))
        .limit(10),
    ]);

    // Compute recommendation distribution
    const recMap: Record<string, number> = { strong_apply: 0, apply: 0, maybe: 0, skip: 0 };
    let totalFit = 0;
    let totalComp = 0;
    for (const row of scoreRows) {
      if (row.recommendation) {
        recMap[row.recommendation] = (recMap[row.recommendation] || 0) + 1;
      }
      totalFit += row.fitScore ?? 0;
      totalComp += row.competitivenessScore ?? 0;
    }
    const n = scoreRows.length || 1;

    // Compute success rate (interview conversion)
    const totalApps = totalAppCount[0]?.count ?? 0;
    const interviewApps = interviewAppCount[0]?.count ?? 0;
    const successRate = totalApps > 0 ? Math.round((interviewApps / totalApps) * 100) : 0;

    // Build activity feed with fields the frontend expects
    const activity: Array<{
      type: 'job_added' | 'application_created' | 'status_changed' | 'job_scored';
      title: string;
      description: string;
      timestamp: string;
      metadata: Record<string, string>;
    }> = [];

    for (const job of recentJobs.slice(0, 5)) {
      activity.push({
        type: 'job_added',
        title: `${job.title} at ${job.company}`,
        description: 'Job added to Flight Plan',
        timestamp: job.createdAt.toISOString(),
        metadata: { jobId: job.id },
      });
    }

    for (const outcome of recentOutcomes.slice(0, 5)) {
      activity.push({
        type: 'status_changed',
        title: outcome.notes || `Stage: ${outcome.stage}`,
        description: `Application updated`,
        timestamp: outcome.occurredAt.toISOString(),
        metadata: { applicationId: outcome.applicationId, stage: outcome.stage },
      });
    }

    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const result = {
      activeFlights: activeAppCount[0]?.count ?? 0,
      targetsAcquired: jobCount[0]?.count ?? 0,
      resumesDeployed: tailoredCount[0]?.count ?? 0,
      successRate,
      scoreDistribution: {
        strongApply: recMap['strong_apply'] ?? 0,
        apply: recMap['apply'] ?? 0,
        maybe: recMap['maybe'] ?? 0,
        skip: recMap['skip'] ?? 0,
        avgFit: scoreRows.length > 0 ? totalFit / n / 100 : 0,
        avgCompetitiveness: scoreRows.length > 0 ? totalComp / n / 100 : 0,
      },
      recentActivity: activity.slice(0, 10),
    };

    await cacheSet(cacheKey, result, 300);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/control-tower
// ---------------------------------------------------------------------------
router.get('/control-tower', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const cacheKey = `dashboard:${ctx.tenantId}:control-tower`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ghostedCutoff = new Date(now.getTime() - GHOSTED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    // -----------------------------------------------------------------------
    // Parallel data fetches
    // -----------------------------------------------------------------------
    const [allApps, unreviewedEmails, recentOutcomeRows, earliestApplied] = await Promise.all([
      // All applications for this tenant, joined with jobs and scores
      db
        .select({
          id: applications.id,
          jobId: applications.jobId,
          status: applications.status,
          subStatus: applications.subStatus,
          statusNote: applications.statusNote,
          appliedAt: applications.appliedAt,
          lastActivityAt: applications.lastActivityAt,
          rejectedAt: applications.rejectedAt,
          declinedByUser: applications.declinedByUser,
          compMin: applications.compMin,
          compMax: applications.compMax,
          equityDetails: applications.equityDetails,
          candidateId: applications.candidateId,
          jobTitle: jobs.title,
          jobCompany: jobs.company,
          score: jobScores.overallScore,
        })
        .from(applications)
        .innerJoin(jobs, eq(applications.jobId, jobs.id))
        .leftJoin(
          jobScores,
          and(
            eq(jobScores.jobId, applications.jobId),
            eq(jobScores.candidateId, applications.candidateId),
          ),
        )
        .where(eq(applications.tenantId, ctx.tenantId)),

      // Unreviewed recruiter emails
      db
        .select({
          id: recruiterMessages.id,
          from: recruiterMessages.from,
          subject: recruiterMessages.subject,
          receivedAt: recruiterMessages.receivedAt,
          applicationId: recruiterMessages.applicationId,
        })
        .from(recruiterMessages)
        .where(
          and(eq(recruiterMessages.tenantId, ctx.tenantId), eq(recruiterMessages.parsed, false)),
        )
        .orderBy(desc(recruiterMessages.receivedAt))
        .limit(20),

      // Recent outcomes (last 7 days)
      db
        .select({
          id: outcomes.id,
          stage: outcomes.stage,
          notes: outcomes.notes,
          occurredAt: outcomes.occurredAt,
          applicationId: outcomes.applicationId,
        })
        .from(outcomes)
        .innerJoin(applications, eq(outcomes.applicationId, applications.id))
        .where(and(eq(applications.tenantId, ctx.tenantId), gte(outcomes.occurredAt, sevenDaysAgo)))
        .orderBy(desc(outcomes.occurredAt))
        .limit(20),

      // Earliest appliedAt for searchStartDate
      db
        .select({ earliest: min(applications.appliedAt) })
        .from(applications)
        .where(and(eq(applications.tenantId, ctx.tenantId), isNotNull(applications.appliedAt))),
    ]);

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    let pendingCount = 0;
    let rejectedCount = 0;
    let inProgressCount = 0;
    let declinedCount = 0;

    for (const app of allApps) {
      if (app.declinedByUser) {
        declinedCount++;
      } else if (app.status === 'rejected' || app.rejectedAt !== null) {
        rejectedCount++;
      } else if (IN_PROGRESS_STATUSES.includes(app.status)) {
        inProgressCount++;
      } else if (PENDING_STATUSES.includes(app.status)) {
        pendingCount++;
      }
    }

    const searchStartDate = earliestApplied[0]?.earliest
      ? earliestApplied[0].earliest.toISOString()
      : null;
    const searchDays = searchStartDate
      ? Math.floor((now.getTime() - new Date(searchStartDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const summary = {
      total: allApps.length,
      pending: pendingCount,
      rejected: rejectedCount,
      inProgress: inProgressCount,
      declined: declinedCount,
      searchStartDate,
      searchDays,
    };

    // -----------------------------------------------------------------------
    // Active Missions
    // -----------------------------------------------------------------------
    const activeApps = allApps
      .filter((app) => !INACTIVE_STATUSES.includes(app.status) && !app.declinedByUser)
      .sort((a, b) => {
        const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 15);

    const activeMissions = activeApps.map((app) => {
      const lastActivity = app.lastActivityAt ? new Date(app.lastActivityAt) : now;
      const daysSinceActivity = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: app.id,
        jobId: app.jobId,
        jobTitle: app.jobTitle,
        jobCompany: app.jobCompany,
        status: app.status,
        subStatus: app.subStatus,
        statusNote: app.statusNote,
        lastActivityAt: lastActivity.toISOString(),
        daysSinceActivity,
        isGhosted: daysSinceActivity > GHOSTED_THRESHOLD_DAYS,
        compMin: app.compMin,
        compMax: app.compMax,
        equityDetails: app.equityDetails,
        score: app.score,
      };
    });

    // -----------------------------------------------------------------------
    // Activity Feed
    // -----------------------------------------------------------------------
    const activityFeed: Array<{
      id: string;
      type: 'unreviewed_email' | 'ghosted_alert' | 'status_change' | 'auto_detected';
      title: string;
      description: string;
      timestamp: string;
      metadata: Record<string, any>;
    }> = [];

    // 1. Unreviewed emails
    for (const email of unreviewedEmails) {
      activityFeed.push({
        id: `email_${email.id}`,
        type: 'unreviewed_email',
        title: email.subject,
        description: `From ${email.from}`,
        timestamp: email.receivedAt.toISOString(),
        metadata: {
          emailId: email.id,
          from: email.from,
          applicationId: email.applicationId,
        },
      });
    }

    // 2. Ghosted alerts from active applications
    for (const app of activeApps) {
      const lastActivity = app.lastActivityAt ? new Date(app.lastActivityAt) : now;
      const daysSince = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSince > GHOSTED_THRESHOLD_DAYS) {
        activityFeed.push({
          id: `ghosted_${app.id}`,
          type: 'ghosted_alert',
          title: `No response from ${app.jobCompany}`,
          description: `${app.jobTitle} — ${daysSince} days since last activity`,
          timestamp: lastActivity.toISOString(),
          metadata: {
            applicationId: app.id,
            jobId: app.jobId,
            daysSinceActivity: daysSince,
          },
        });
      }
    }

    // 3. Recent status changes (outcomes from last 7 days)
    for (const outcome of recentOutcomeRows) {
      activityFeed.push({
        id: `outcome_${outcome.id}`,
        type: 'status_change',
        title: `Status updated to ${outcome.stage}`,
        description: outcome.notes || 'Application status changed',
        timestamp: outcome.occurredAt.toISOString(),
        metadata: {
          outcomeId: outcome.id,
          applicationId: outcome.applicationId,
          stage: outcome.stage,
        },
      });
    }

    // Sort all activity by timestamp desc and limit to 20
    activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const trimmedFeed = activityFeed.slice(0, 20);

    // -----------------------------------------------------------------------
    // Pipeline
    // -----------------------------------------------------------------------

    // Funnel counts
    let funnelApplied = 0;
    let funnelScreen = 0;
    let funnelInterview = 0;
    let funnelOffer = 0;

    for (const app of allApps) {
      if (FUNNEL_OFFER_STATUSES.includes(app.status)) funnelOffer++;
      else if (FUNNEL_INTERVIEW_STATUSES.includes(app.status)) funnelInterview++;
      else if (FUNNEL_SCREEN_STATUSES.includes(app.status)) funnelScreen++;
      else if (FUNNEL_APPLIED_STATUSES.includes(app.status)) funnelApplied++;
    }

    // Rejection stats
    const rejectionDays: number[] = [];
    for (const app of allApps) {
      if (app.rejectedAt && app.appliedAt) {
        const days = Math.floor(
          (new Date(app.rejectedAt).getTime() - new Date(app.appliedAt).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (days >= 0) rejectionDays.push(days);
      }
    }

    const rejectionStats = {
      avgDays:
        rejectionDays.length > 0
          ? Math.round(rejectionDays.reduce((sum, d) => sum + d, 0) / rejectionDays.length)
          : 0,
      fastest: rejectionDays.length > 0 ? Math.min(...rejectionDays) : 0,
      count: rejectionDays.length,
    };

    // Compensation summary (only active, non-rejected apps with comp data)
    const activeWithComp = allApps.filter(
      (app) =>
        !INACTIVE_STATUSES.includes(app.status) &&
        !app.declinedByUser &&
        (app.compMin !== null || app.compMax !== null),
    );

    let minSalary: number | null = null;
    let maxSalary: number | null = null;
    let withEquity = 0;
    let midpointSum = 0;
    let midpointCount = 0;

    for (const app of activeWithComp) {
      if (app.compMin !== null) {
        minSalary = minSalary === null ? app.compMin : Math.min(minSalary, app.compMin);
      }
      if (app.compMax !== null) {
        maxSalary = maxSalary === null ? app.compMax : Math.max(maxSalary, app.compMax);
      }
      if (app.equityDetails) {
        withEquity++;
      }
      if (app.compMin !== null && app.compMax !== null) {
        midpointSum += (app.compMin + app.compMax) / 2;
        midpointCount++;
      }
    }

    const compSummary = {
      minSalary,
      maxSalary,
      withEquity,
      avgMidpoint: midpointCount > 0 ? Math.round(midpointSum / midpointCount) : null,
    };

    const pipeline = {
      funnel: {
        applied: funnelApplied,
        screen: funnelScreen,
        interview: funnelInterview,
        offer: funnelOffer,
      },
      rejectionStats,
      compSummary,
    };

    // -----------------------------------------------------------------------
    // Final response
    // -----------------------------------------------------------------------
    const result = {
      summary,
      activeMissions,
      activityFeed: trimmedFeed,
      pipeline,
    };

    await cacheSet(cacheKey, result, 120); // 2-minute cache for control tower
    capture(ctx.userId, 'dashboard_loaded', {
      tenantId: ctx.tenantId,
      totalApplications: summary.total,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
