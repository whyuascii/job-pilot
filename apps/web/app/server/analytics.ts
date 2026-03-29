import { createServerFn } from '@tanstack/react-start';
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@job-pilot/db';
import {
  applications,
  jobs,
  jobScores,
  jobSources,
  outcomes,
  tailoredResumes,
} from '@job-pilot/db/schema';
import { getTenantContext } from '~/lib/api';

/**
 * Ordered pipeline stages for funnel analysis.
 */
const STAGE_ORDER = [
  'discovered',
  'shortlisted',
  'resume_generated',
  'applied',
  'recruiter_screen',
  'technical',
  'onsite',
  'final',
  'offer',
] as const;

export type FunnelStage = { stage: string; count: number; percentage: number };
export type ConversionRate = { from: string; to: string; rate: number };
export type AverageTimeInStage = { stage: string; avgDays: number };
export type TopCompany = { company: string; count: number; advanceRate: number };

export type FunnelAnalytics = {
  funnelStages: FunnelStage[];
  conversionRates: ConversionRate[];
  averageTimeInStage: AverageTimeInStage[];
  topCompanies: TopCompany[];
};

export const getFunnelAnalytics = createServerFn({ method: 'GET' }).handler(
  async (): Promise<FunnelAnalytics> => {
    const ctx = await getTenantContext();

    // ----- 1. Funnel stages: count applications by status -----
    const statusCounts = await db
      .select({
        status: applications.status,
        count: count(),
      })
      .from(applications)
      .where(eq(applications.tenantId, ctx.tenantId))
      .groupBy(applications.status);

    const statusMap: Record<string, number> = {};
    let totalApplications = 0;
    for (const row of statusCounts) {
      statusMap[row.status] = row.count;
      totalApplications += row.count;
    }

    // Include rejected/withdrawn in the total but build funnel from ordered stages
    const allStages = [...STAGE_ORDER, 'rejected', 'withdrawn'] as const;
    const funnelStages: FunnelStage[] = allStages
      .filter((stage) => (statusMap[stage] ?? 0) > 0 || STAGE_ORDER.includes(stage as any))
      .map((stage) => ({
        stage,
        count: statusMap[stage] ?? 0,
        percentage:
          totalApplications > 0
            ? Math.round(((statusMap[stage] ?? 0) / totalApplications) * 100)
            : 0,
      }));

    // ----- 2. Conversion rates between consecutive stages -----
    // We compute how many applications that reached stage N also reached stage N+1.
    // An application has "reached" a stage if its current status is that stage or any
    // stage that comes after it in the pipeline (excluding rejected/withdrawn).
    const conversionRates: ConversionRate[] = [];
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      const fromStage = STAGE_ORDER[i];
      const toStage = STAGE_ORDER[i + 1];

      // Applications that reached `fromStage` = those whose current status is fromStage
      // or any later stage (including rejected/withdrawn, since they passed through).
      const stagesAtOrAfterFrom = [...STAGE_ORDER.slice(i), 'rejected', 'withdrawn'];
      const stagesAtOrAfterTo = [...STAGE_ORDER.slice(i + 1), 'rejected', 'withdrawn'];

      // Count via outcomes table for more accurate transitions
      const fromCount = stagesAtOrAfterFrom.reduce((sum, s) => sum + (statusMap[s] ?? 0), 0);
      const toCount = stagesAtOrAfterTo.reduce((sum, s) => sum + (statusMap[s] ?? 0), 0);

      conversionRates.push({
        from: fromStage,
        to: toStage,
        rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0,
      });
    }

    // ----- 3. Average time in stage (from outcomes transitions) -----
    // Compute average days between consecutive outcomes for each stage.
    const outcomeRows = await db
      .select({
        applicationId: outcomes.applicationId,
        stage: outcomes.stage,
        occurredAt: outcomes.occurredAt,
      })
      .from(outcomes)
      .innerJoin(applications, eq(outcomes.applicationId, applications.id))
      .where(eq(applications.tenantId, ctx.tenantId))
      .orderBy(outcomes.applicationId, outcomes.occurredAt);

    // Group outcomes by application
    const outcomesByApp: Record<string, { stage: string; occurredAt: Date }[]> = {};
    for (const row of outcomeRows) {
      if (!outcomesByApp[row.applicationId]) {
        outcomesByApp[row.applicationId] = [];
      }
      outcomesByApp[row.applicationId].push({
        stage: row.stage,
        occurredAt: row.occurredAt,
      });
    }

    // Calculate time spent in each stage
    const stageDurations: Record<string, number[]> = {};
    for (const appOutcomes of Object.values(outcomesByApp)) {
      // Sort by occurredAt
      appOutcomes.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      for (let i = 0; i < appOutcomes.length - 1; i++) {
        const stage = appOutcomes[i].stage;
        const daysInStage =
          (appOutcomes[i + 1].occurredAt.getTime() - appOutcomes[i].occurredAt.getTime()) /
          (1000 * 60 * 60 * 24);
        if (!stageDurations[stage]) {
          stageDurations[stage] = [];
        }
        stageDurations[stage].push(daysInStage);
      }
    }

    const averageTimeInStage: AverageTimeInStage[] = allStages
      .filter((stage) => stageDurations[stage] && stageDurations[stage].length > 0)
      .map((stage) => {
        const durations = stageDurations[stage];
        const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        return {
          stage,
          avgDays: Math.round(avg * 10) / 10,
        };
      });

    // ----- 4. Top companies by application count and advance rate -----
    const companyStats = await db
      .select({
        company: jobs.company,
        totalCount: count(),
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.tenantId, ctx.tenantId))
      .groupBy(jobs.company)
      .orderBy(desc(count()))
      .limit(10);

    // For each top company, compute the advance rate (past applied stage)
    const advancedStages = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];
    const companyAdvanced = await db
      .select({
        company: jobs.company,
        advancedCount: count(),
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          eq(applications.tenantId, ctx.tenantId),
          sql`${applications.status} IN (${sql.join(
            advancedStages.map((s) => sql`${s}`),
            sql`, `,
          )})`,
        ),
      )
      .groupBy(jobs.company);

    const advancedMap: Record<string, number> = {};
    for (const row of companyAdvanced) {
      advancedMap[row.company] = row.advancedCount;
    }

    // Score correlations: average overall score for applications by company
    const _scoreCorrelations = await db
      .select({
        company: jobs.company,
        avgScore: sql<number>`avg(${jobScores.overallScore})`,
      })
      .from(jobScores)
      .innerJoin(jobs, eq(jobScores.jobId, jobs.id))
      .innerJoin(applications, eq(applications.jobId, jobs.id))
      .where(eq(applications.tenantId, ctx.tenantId))
      .groupBy(jobs.company);

    const topCompanies: TopCompany[] = companyStats.map((row) => ({
      company: row.company,
      count: row.totalCount,
      advanceRate:
        row.totalCount > 0
          ? Math.round(((advancedMap[row.company] ?? 0) / row.totalCount) * 100)
          : 0,
    }));

    return {
      funnelStages,
      conversionRates,
      averageTimeInStage,
      topCompanies,
    };
  },
);

// ===========================================================================
// Feature 1: Score Correlation Analysis
// ===========================================================================

/**
 * Stages that count as "successful" outcomes — the application progressed
 * to a meaningful interview or offer stage.
 */
const SUCCESS_STAGES = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'] as const;

export type ScoreDimension = {
  dimension: string;
  label: string;
  successfulAvg: number;
  allAvg: number;
  delta: number; // successfulAvg - allAvg
};

export type ScoreCorrelationAnalytics = {
  fitDimensions: ScoreDimension[];
  competitivenessDimensions: ScoreDimension[];
  successfulCount: number;
  totalCount: number;
};

export const getScoreCorrelationAnalytics = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ScoreCorrelationAnalytics> => {
    const ctx = await getTenantContext();

    // Get all applications with their job scores
    const allAppScores = await db
      .select({
        applicationId: applications.id,
        status: applications.status,
        fitScore: jobScores.fitScore,
        competitivenessScore: jobScores.competitivenessScore,
        overallScore: jobScores.overallScore,
        fitBreakdown: jobScores.fitBreakdown,
        competitivenessBreakdown: jobScores.competitivenessBreakdown,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(
        jobScores,
        and(eq(jobScores.jobId, jobs.id), eq(jobScores.candidateId, applications.candidateId)),
      )
      .where(eq(applications.tenantId, ctx.tenantId));

    if (allAppScores.length === 0) {
      return {
        fitDimensions: [],
        competitivenessDimensions: [],
        successfulCount: 0,
        totalCount: 0,
      };
    }

    const successfulApps = allAppScores.filter((a) => SUCCESS_STAGES.includes(a.status as any));

    // Fit breakdown dimension keys and labels
    const fitKeys: { key: string; label: string }[] = [
      { key: 'titleMatch', label: 'Title Match' },
      { key: 'compensationFit', label: 'Compensation Fit' },
      { key: 'locationFit', label: 'Location Fit' },
      { key: 'stackOverlap', label: 'Stack Overlap' },
      { key: 'seniorityFit', label: 'Seniority Fit' },
      { key: 'industryFit', label: 'Industry Fit' },
    ];

    const compKeys: { key: string; label: string }[] = [
      { key: 'requiredSkillsOverlap', label: 'Required Skills Overlap' },
      { key: 'experienceDepth', label: 'Experience Depth' },
      { key: 'domainRelevance', label: 'Domain Relevance' },
      { key: 'leadershipMatch', label: 'Leadership Match' },
      { key: 'adjacentSkills', label: 'Adjacent Skills' },
      { key: 'gapPenalty', label: 'Gap Penalty' },
    ];

    function avgDimension(
      rows: typeof allAppScores,
      breakdownField: 'fitBreakdown' | 'competitivenessBreakdown',
      key: string,
    ): number {
      if (rows.length === 0) return 0;
      const values = rows.map((r) => {
        const breakdown = r[breakdownField] as Record<string, number> | null;
        return breakdown?.[key] ?? 0;
      });
      const sum = values.reduce((a, b) => a + b, 0);
      return Math.round((sum / values.length) * 10) / 10;
    }

    const fitDimensions: ScoreDimension[] = fitKeys.map(({ key, label }) => {
      const allAvg = avgDimension(allAppScores, 'fitBreakdown', key);
      const successfulAvg = avgDimension(successfulApps, 'fitBreakdown', key);
      return {
        dimension: key,
        label,
        successfulAvg,
        allAvg,
        delta: Math.round((successfulAvg - allAvg) * 10) / 10,
      };
    });

    const competitivenessDimensions: ScoreDimension[] = compKeys.map(({ key, label }) => {
      const allAvg = avgDimension(allAppScores, 'competitivenessBreakdown', key);
      const successfulAvg = avgDimension(successfulApps, 'competitivenessBreakdown', key);
      return {
        dimension: key,
        label,
        successfulAvg,
        allAvg,
        delta: Math.round((successfulAvg - allAvg) * 10) / 10,
      };
    });

    return {
      fitDimensions,
      competitivenessDimensions,
      successfulCount: successfulApps.length,
      totalCount: allAppScores.length,
    };
  },
);

// ===========================================================================
// Feature 2: Company/Source Effectiveness Metrics
// ===========================================================================

export type CompanyEffectiveness = {
  company: string;
  totalApplications: number;
  advancedApplications: number;
  responseRate: number; // percentage that moved past "applied"
};

export type SourceEffectiveness = {
  sourceName: string;
  sourceId: string;
  jobCount: number;
  applicationCount: number;
  interviewCount: number;
  avgScore: number;
  conversionRate: number; // interview / applications
};

export type SourceEffectivenessAnalytics = {
  topCompaniesByResponse: CompanyEffectiveness[];
  sourceMetrics: SourceEffectiveness[];
};

export const getSourceEffectivenessAnalytics = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SourceEffectivenessAnalytics> => {
    const ctx = await getTenantContext();

    // ----- Companies by response rate -----
    // Total applications per company
    const companyTotal = await db
      .select({
        company: jobs.company,
        total: count(),
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(eq(applications.tenantId, ctx.tenantId))
      .groupBy(jobs.company);

    // Applications that advanced past "applied" (recruiter_screen, technical, onsite, final, offer)
    const advancedStatuses = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];
    const companyAdvanced = await db
      .select({
        company: jobs.company,
        advanced: count(),
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          eq(applications.tenantId, ctx.tenantId),
          sql`${applications.status} IN (${sql.join(
            advancedStatuses.map((s) => sql`${s}`),
            sql`, `,
          )})`,
        ),
      )
      .groupBy(jobs.company);

    const advMap: Record<string, number> = {};
    for (const row of companyAdvanced) {
      advMap[row.company] = row.advanced;
    }

    const topCompaniesByResponse: CompanyEffectiveness[] = companyTotal
      .map((row) => ({
        company: row.company,
        totalApplications: row.total,
        advancedApplications: advMap[row.company] ?? 0,
        responseRate:
          row.total > 0 ? Math.round(((advMap[row.company] ?? 0) / row.total) * 100) : 0,
      }))
      .sort((a, b) => b.responseRate - a.responseRate)
      .slice(0, 10);

    // ----- Source effectiveness metrics -----
    // Jobs per source
    const sourceJobCounts = await db
      .select({
        sourceId: jobs.sourceId,
        sourceName: jobSources.name,
        jobCount: count(),
      })
      .from(jobs)
      .innerJoin(jobSources, eq(jobs.sourceId, jobSources.id))
      .where(eq(jobs.tenantId, ctx.tenantId))
      .groupBy(jobs.sourceId, jobSources.name);

    // Applications per source
    const sourceAppCounts = await db
      .select({
        sourceId: jobs.sourceId,
        appCount: count(),
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(and(eq(applications.tenantId, ctx.tenantId), isNotNull(jobs.sourceId)))
      .groupBy(jobs.sourceId);

    // Interview-stage applications per source
    const interviewStatuses = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];
    const sourceInterviewCounts = await db
      .select({
        sourceId: jobs.sourceId,
        interviewCount: count(),
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(
        and(
          eq(applications.tenantId, ctx.tenantId),
          isNotNull(jobs.sourceId),
          sql`${applications.status} IN (${sql.join(
            interviewStatuses.map((s) => sql`${s}`),
            sql`, `,
          )})`,
        ),
      )
      .groupBy(jobs.sourceId);

    // Average score per source
    const sourceAvgScores = await db
      .select({
        sourceId: jobs.sourceId,
        avgScore: sql<number>`round(avg(${jobScores.overallScore})::numeric, 1)`,
      })
      .from(jobScores)
      .innerJoin(jobs, eq(jobScores.jobId, jobs.id))
      .where(and(eq(jobs.tenantId, ctx.tenantId), isNotNull(jobs.sourceId)))
      .groupBy(jobs.sourceId);

    // Build maps
    const appCountMap: Record<string, number> = {};
    for (const row of sourceAppCounts) {
      if (row.sourceId) appCountMap[row.sourceId] = row.appCount;
    }
    const interviewMap: Record<string, number> = {};
    for (const row of sourceInterviewCounts) {
      if (row.sourceId) interviewMap[row.sourceId] = row.interviewCount;
    }
    const scoreMap: Record<string, number> = {};
    for (const row of sourceAvgScores) {
      if (row.sourceId) scoreMap[row.sourceId] = Number(row.avgScore) || 0;
    }

    const sourceMetrics: SourceEffectiveness[] = sourceJobCounts
      .filter((row) => row.sourceId !== null)
      .map((row) => {
        const sid = row.sourceId!;
        const appCount = appCountMap[sid] ?? 0;
        const intCount = interviewMap[sid] ?? 0;
        return {
          sourceName: row.sourceName,
          sourceId: sid,
          jobCount: row.jobCount,
          applicationCount: appCount,
          interviewCount: intCount,
          avgScore: scoreMap[sid] ?? 0,
          conversionRate: appCount > 0 ? Math.round((intCount / appCount) * 100) : 0,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    return {
      topCompaniesByResponse,
      sourceMetrics,
    };
  },
);

// ===========================================================================
// Feature 3: Resume Variant Performance Tracking
// ===========================================================================

export type ResumeVariantPerformance = {
  resumeId: string;
  jobTitle: string;
  company: string;
  version: number;
  applicationStatus: string;
  isSuccessful: boolean;
  createdAt: string;
};

export type ResumePerformanceSummary = {
  totalVariants: number;
  successfulVariants: number;
  successRate: number;
};

export type ResumeVariantAnalytics = {
  variants: ResumeVariantPerformance[];
  summary: ResumePerformanceSummary;
};

export const getResumeVariantAnalytics = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ResumeVariantAnalytics> => {
    const ctx = await getTenantContext();

    const successStatuses = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];

    // Get all tailored resumes with their application outcomes
    const resumeRows = await db
      .select({
        resumeId: tailoredResumes.id,
        version: tailoredResumes.version,
        createdAt: tailoredResumes.createdAt,
        jobTitle: jobs.title,
        company: jobs.company,
        applicationId: applications.id,
        applicationStatus: applications.status,
      })
      .from(tailoredResumes)
      .innerJoin(jobs, eq(tailoredResumes.jobId, jobs.id))
      .leftJoin(
        applications,
        and(
          eq(applications.tailoredResumeId, tailoredResumes.id),
          eq(applications.tenantId, ctx.tenantId),
        ),
      )
      .where(eq(tailoredResumes.tenantId, ctx.tenantId))
      .orderBy(desc(tailoredResumes.createdAt));

    const variants: ResumeVariantPerformance[] = resumeRows.map((row) => {
      const status = row.applicationStatus ?? 'no_application';
      const isSuccessful = successStatuses.includes(status);
      return {
        resumeId: row.resumeId,
        jobTitle: row.jobTitle,
        company: row.company,
        version: row.version,
        applicationStatus: status,
        isSuccessful,
        createdAt: row.createdAt.toISOString(),
      };
    });

    // Only count variants that have associated applications for the success rate
    const variantsWithApps = variants.filter((v) => v.applicationStatus !== 'no_application');
    const successfulVariants = variantsWithApps.filter((v) => v.isSuccessful);

    const summary: ResumePerformanceSummary = {
      totalVariants: variantsWithApps.length,
      successfulVariants: successfulVariants.length,
      successRate:
        variantsWithApps.length > 0
          ? Math.round((successfulVariants.length / variantsWithApps.length) * 100)
          : 0,
    };

    return { variants, summary };
  },
);
