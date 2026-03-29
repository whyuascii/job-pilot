import { Router } from 'express';
import { db } from '@job-pilot/db';
import { applications, outcomes, jobs, jobScores, jobSources, tailoredResumes } from '@job-pilot/db/schema';
import { eq, and, count, sql, desc, isNotNull } from 'drizzle-orm';
import { getTenantContext } from '../lib/context.js';

const STAGE_ORDER = ['discovered', 'shortlisted', 'resume_generated', 'applied', 'recruiter_screen', 'technical', 'onsite', 'final', 'offer'] as const;
const SUCCESS_STAGES = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'] as const;

const router = Router();

router.get('/funnel', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const statusCounts = await db.select({ status: applications.status, count: count() }).from(applications).where(eq(applications.tenantId, ctx.tenantId)).groupBy(applications.status);
    const statusMap: Record<string, number> = {};
    let totalApplications = 0;
    for (const row of statusCounts) { statusMap[row.status] = row.count; totalApplications += row.count; }
    const allStages = [...STAGE_ORDER, 'rejected', 'withdrawn'] as const;
    const funnelStages = allStages.filter((stage) => (statusMap[stage] ?? 0) > 0 || (STAGE_ORDER as readonly string[]).includes(stage)).map((stage) => ({ stage, count: statusMap[stage] ?? 0, percentage: totalApplications > 0 ? Math.round(((statusMap[stage] ?? 0) / totalApplications) * 100) : 0 }));
    const conversionRates: any[] = [];
    for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
      const stagesAtOrAfterFrom = [...STAGE_ORDER.slice(i), 'rejected', 'withdrawn'];
      const stagesAtOrAfterTo = [...STAGE_ORDER.slice(i + 1), 'rejected', 'withdrawn'];
      const fromCount = stagesAtOrAfterFrom.reduce((sum, s) => sum + (statusMap[s] ?? 0), 0);
      const toCount = stagesAtOrAfterTo.reduce((sum, s) => sum + (statusMap[s] ?? 0), 0);
      conversionRates.push({ from: STAGE_ORDER[i], to: STAGE_ORDER[i + 1], rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0 });
    }
    const outcomeRows = await db.select({ applicationId: outcomes.applicationId, stage: outcomes.stage, occurredAt: outcomes.occurredAt }).from(outcomes).innerJoin(applications, eq(outcomes.applicationId, applications.id)).where(eq(applications.tenantId, ctx.tenantId)).orderBy(outcomes.applicationId, outcomes.occurredAt);
    const outcomesByApp: Record<string, { stage: string; occurredAt: Date }[]> = {};
    for (const row of outcomeRows) { if (!outcomesByApp[row.applicationId]) outcomesByApp[row.applicationId] = []; outcomesByApp[row.applicationId].push({ stage: row.stage, occurredAt: row.occurredAt }); }
    const stageDurations: Record<string, number[]> = {};
    for (const appOutcomes of Object.values(outcomesByApp)) {
      appOutcomes.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
      for (let i = 0; i < appOutcomes.length - 1; i++) {
        const stage = appOutcomes[i].stage;
        const days = (appOutcomes[i + 1].occurredAt.getTime() - appOutcomes[i].occurredAt.getTime()) / (1000 * 60 * 60 * 24);
        if (!stageDurations[stage]) stageDurations[stage] = [];
        stageDurations[stage].push(days);
      }
    }
    const averageTimeInStage = allStages.filter((s) => stageDurations[s]?.length).map((s) => ({ stage: s, avgDays: Math.round((stageDurations[s].reduce((a, b) => a + b, 0) / stageDurations[s].length) * 10) / 10 }));
    const companyStats = await db.select({ company: jobs.company, totalCount: count() }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id)).where(eq(applications.tenantId, ctx.tenantId)).groupBy(jobs.company).orderBy(desc(count())).limit(10);
    const companyAdvanced = await db.select({ company: jobs.company, advancedCount: count() }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id)).where(and(eq(applications.tenantId, ctx.tenantId), sql`${applications.status} IN (${sql.join(SUCCESS_STAGES.map((s) => sql`${s}`), sql`, `)})`)).groupBy(jobs.company);
    const advMap: Record<string, number> = {};
    for (const row of companyAdvanced) advMap[row.company] = row.advancedCount;
    const topCompanies = companyStats.map((row) => ({ company: row.company, count: row.totalCount, advanceRate: row.totalCount > 0 ? Math.round(((advMap[row.company] ?? 0) / row.totalCount) * 100) : 0 }));
    res.json({ funnelStages, conversionRates, averageTimeInStage, topCompanies });
  } catch (e) { next(e); }
});

router.get('/score-correlation', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const allAppScores = await db.select({ applicationId: applications.id, status: applications.status, fitScore: jobScores.fitScore, competitivenessScore: jobScores.competitivenessScore, overallScore: jobScores.overallScore, fitBreakdown: jobScores.fitBreakdown, competitivenessBreakdown: jobScores.competitivenessBreakdown }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id)).innerJoin(jobScores, and(eq(jobScores.jobId, jobs.id), eq(jobScores.candidateId, applications.candidateId))).where(eq(applications.tenantId, ctx.tenantId));
    if (allAppScores.length === 0) { res.json({ fitDimensions: [], competitivenessDimensions: [], successfulCount: 0, totalCount: 0 }); return; }
    const successfulApps = allAppScores.filter((a) => SUCCESS_STAGES.includes(a.status as any));
    const fitKeys = [{ key: 'titleMatch', label: 'Title Match' }, { key: 'compensationFit', label: 'Compensation Fit' }, { key: 'locationFit', label: 'Location Fit' }, { key: 'stackOverlap', label: 'Stack Overlap' }, { key: 'seniorityFit', label: 'Seniority Fit' }, { key: 'industryFit', label: 'Industry Fit' }];
    const compKeys = [{ key: 'requiredSkillsOverlap', label: 'Required Skills Overlap' }, { key: 'experienceDepth', label: 'Experience Depth' }, { key: 'domainRelevance', label: 'Domain Relevance' }, { key: 'leadershipMatch', label: 'Leadership Match' }, { key: 'adjacentSkills', label: 'Adjacent Skills' }, { key: 'gapPenalty', label: 'Gap Penalty' }];
    function avgDim(rows: typeof allAppScores, field: 'fitBreakdown' | 'competitivenessBreakdown', key: string): number { if (!rows.length) return 0; const vals = rows.map((r) => ((r[field] as any)?.[key] ?? 0)); return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10; }
    res.json({
      fitDimensions: fitKeys.map(({ key, label }) => { const allAvg = avgDim(allAppScores, 'fitBreakdown', key); const sAvg = avgDim(successfulApps, 'fitBreakdown', key); return { dimension: key, label, successfulAvg: sAvg, allAvg, delta: Math.round((sAvg - allAvg) * 10) / 10 }; }),
      competitivenessDimensions: compKeys.map(({ key, label }) => { const allAvg = avgDim(allAppScores, 'competitivenessBreakdown', key); const sAvg = avgDim(successfulApps, 'competitivenessBreakdown', key); return { dimension: key, label, successfulAvg: sAvg, allAvg, delta: Math.round((sAvg - allAvg) * 10) / 10 }; }),
      successfulCount: successfulApps.length, totalCount: allAppScores.length,
    });
  } catch (e) { next(e); }
});

router.get('/source-effectiveness', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const companyTotal = await db.select({ company: jobs.company, total: count() }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id)).where(eq(applications.tenantId, ctx.tenantId)).groupBy(jobs.company);
    const advancedStatuses = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];
    const companyAdvanced = await db.select({ company: jobs.company, advanced: count() }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id)).where(and(eq(applications.tenantId, ctx.tenantId), sql`${applications.status} IN (${sql.join(advancedStatuses.map((s) => sql`${s}`), sql`, `)})`)).groupBy(jobs.company);
    const advMap: Record<string, number> = {};
    for (const row of companyAdvanced) advMap[row.company] = row.advanced;
    const topCompaniesByResponse = companyTotal.map((row) => ({ company: row.company, totalApplications: row.total, advancedApplications: advMap[row.company] ?? 0, responseRate: row.total > 0 ? Math.round(((advMap[row.company] ?? 0) / row.total) * 100) : 0 })).sort((a, b) => b.responseRate - a.responseRate).slice(0, 10);
    const sourceJobCounts = await db.select({ sourceId: jobs.sourceId, sourceName: jobSources.name, jobCount: count() }).from(jobs).innerJoin(jobSources, eq(jobs.sourceId, jobSources.id)).where(eq(jobs.tenantId, ctx.tenantId)).groupBy(jobs.sourceId, jobSources.name);
    const sourceAppCounts = await db.select({ sourceId: jobs.sourceId, appCount: count() }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id)).where(and(eq(applications.tenantId, ctx.tenantId), isNotNull(jobs.sourceId))).groupBy(jobs.sourceId);
    const sourceInterviewCounts = await db.select({ sourceId: jobs.sourceId, interviewCount: count() }).from(applications).innerJoin(jobs, eq(applications.jobId, jobs.id)).where(and(eq(applications.tenantId, ctx.tenantId), isNotNull(jobs.sourceId), sql`${applications.status} IN (${sql.join(advancedStatuses.map((s) => sql`${s}`), sql`, `)})`)).groupBy(jobs.sourceId);
    const sourceAvgScores = await db.select({ sourceId: jobs.sourceId, avgScore: sql<number>`round(avg(${jobScores.overallScore})::numeric, 1)` }).from(jobScores).innerJoin(jobs, eq(jobScores.jobId, jobs.id)).where(and(eq(jobs.tenantId, ctx.tenantId), isNotNull(jobs.sourceId))).groupBy(jobs.sourceId);
    const appMap: Record<string, number> = {}; for (const r of sourceAppCounts) if (r.sourceId) appMap[r.sourceId] = r.appCount;
    const intMap: Record<string, number> = {}; for (const r of sourceInterviewCounts) if (r.sourceId) intMap[r.sourceId] = r.interviewCount;
    const scoreMap: Record<string, number> = {}; for (const r of sourceAvgScores) if (r.sourceId) scoreMap[r.sourceId] = Number(r.avgScore) || 0;
    const sourceMetrics = sourceJobCounts.filter((r) => r.sourceId).map((r) => { const sid = r.sourceId!; const ac = appMap[sid] ?? 0; const ic = intMap[sid] ?? 0; return { sourceName: r.sourceName, sourceId: sid, jobCount: r.jobCount, applicationCount: ac, interviewCount: ic, avgScore: scoreMap[sid] ?? 0, conversionRate: ac > 0 ? Math.round((ic / ac) * 100) : 0 }; }).sort((a, b) => b.avgScore - a.avgScore);
    res.json({ topCompaniesByResponse, sourceMetrics });
  } catch (e) { next(e); }
});

router.get('/resume-variants', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const successStatuses = ['recruiter_screen', 'technical', 'onsite', 'final', 'offer'];
    const rows = await db.select({ resumeId: tailoredResumes.id, version: tailoredResumes.version, createdAt: tailoredResumes.createdAt, jobTitle: jobs.title, company: jobs.company, applicationId: applications.id, applicationStatus: applications.status }).from(tailoredResumes).innerJoin(jobs, eq(tailoredResumes.jobId, jobs.id)).leftJoin(applications, and(eq(applications.tailoredResumeId, tailoredResumes.id), eq(applications.tenantId, ctx.tenantId))).where(eq(tailoredResumes.tenantId, ctx.tenantId)).orderBy(desc(tailoredResumes.createdAt));
    const variants = rows.map((r) => { const status = r.applicationStatus ?? 'no_application'; return { resumeId: r.resumeId, jobTitle: r.jobTitle, company: r.company, version: r.version, applicationStatus: status, isSuccessful: successStatuses.includes(status), createdAt: r.createdAt.toISOString() }; });
    const withApps = variants.filter((v) => v.applicationStatus !== 'no_application');
    const successful = withApps.filter((v) => v.isSuccessful);
    res.json({ variants, summary: { totalVariants: withApps.length, successfulVariants: successful.length, successRate: withApps.length > 0 ? Math.round((successful.length / withApps.length) * 100) : 0 } });
  } catch (e) { next(e); }
});

export default router;
