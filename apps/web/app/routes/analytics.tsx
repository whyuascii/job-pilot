import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Plane,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import { Skeleton } from '@job-pilot/ui';

import { api } from '~/lib/api-client';

type FunnelStage = { stage: string; count: number; percentage: number };
type ConversionRate = { from: string; to: string; rate: number };
type AverageTimeInStage = { stage: string; avgDays: number };
type TopCompany = { company: string; count: number; advanceRate: number };
type FunnelAnalytics = {
  funnelStages: FunnelStage[];
  conversionRates: ConversionRate[];
  averageTimeInStage: AverageTimeInStage[];
  topCompanies: TopCompany[];
};
type ScoreDimension = {
  dimension: string;
  label: string;
  successfulAvg: number;
  allAvg: number;
  delta: number;
};
type ScoreCorrelationAnalytics = {
  fitDimensions: ScoreDimension[];
  competitivenessDimensions: ScoreDimension[];
  successfulCount: number;
  totalCount: number;
};
type CompanyEffectiveness = {
  company: string;
  totalApplications: number;
  advancedApplications: number;
  responseRate: number;
};
type SourceEffectiveness = {
  sourceName: string;
  sourceId: string;
  jobCount: number;
  applicationCount: number;
  interviewCount: number;
  avgScore: number;
  conversionRate: number;
};
type SourceEffectivenessAnalytics = {
  topCompaniesByResponse: CompanyEffectiveness[];
  sourceMetrics: SourceEffectiveness[];
};
type ResumeVariantPerformance = {
  resumeId: string;
  jobTitle: string;
  company: string;
  version: number;
  applicationStatus: string;
  isSuccessful: boolean;
  createdAt: string;
};
type ResumePerformanceSummary = {
  totalVariants: number;
  successfulVariants: number;
  successRate: number;
};
type ResumeVariantAnalytics = {
  variants: ResumeVariantPerformance[];
  summary: ResumePerformanceSummary;
};

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

const stageLabels: Record<string, string> = {
  discovered: 'Saved',
  shortlisted: 'Shortlisted',
  resume_generated: 'Resume Ready',
  applied: 'Applied',
  recruiter_screen: 'Phone Screen',
  technical: 'Technical Interview',
  onsite: 'Onsite Interview',
  final: 'Final Round',
  offer: 'Offer Received',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  no_application: 'No Application',
};

const stageColors: Record<string, string> = {
  discovered: 'bg-sky-300',
  shortlisted: 'bg-sky-400',
  resume_generated: 'bg-indigo-400',
  applied: 'bg-blue-500',
  recruiter_screen: 'bg-violet-500',
  technical: 'bg-purple-500',
  onsite: 'bg-amber-500',
  final: 'bg-rose-500',
  offer: 'bg-emerald-500',
  rejected: 'bg-red-400',
  withdrawn: 'bg-zinc-400',
};

const stageBadgeColors: Record<string, string> = {
  discovered: 'bg-white text-sky-700 border border-sky-300',
  shortlisted: 'bg-white text-sky-700 border border-sky-300',
  resume_generated: 'bg-white text-indigo-700 border border-indigo-300',
  applied: 'bg-white text-blue-700 border border-blue-300',
  recruiter_screen: 'bg-white text-violet-700 border border-violet-300',
  technical: 'bg-white text-purple-700 border border-purple-300',
  onsite: 'bg-white text-amber-900 border border-amber-300',
  final: 'bg-white text-rose-700 border border-rose-300',
  offer: 'bg-white text-emerald-700 border border-emerald-300',
  rejected: 'bg-white text-red-700 border border-red-300',
  withdrawn: 'bg-white text-muted-foreground border border-border',
};

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

type AnalyticsLoaderData = {
  funnel: FunnelAnalytics;
  scoreCorrelation: ScoreCorrelationAnalytics;
  sourceEffectiveness: SourceEffectivenessAnalytics;
  resumeVariants: ResumeVariantAnalytics;
};

export const Route = createFileRoute('/analytics')({
  loader: async (): Promise<AnalyticsLoaderData> => {
    const [funnel, scoreCorrelation, sourceEffectiveness, resumeVariants] = await Promise.all([
      api.analytics.getFunnel(),
      api.analytics.getScoreCorrelation(),
      api.analytics.getSourceEffectiveness(),
      api.analytics.getResumeVariants(),
    ]);
    return { funnel, scoreCorrelation, sourceEffectiveness, resumeVariants };
  },
  component: AnalyticsPage,
  pendingComponent: AnalyticsSkeleton,
});

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function AnalyticsPage() {
  const data = Route.useLoaderData() as AnalyticsLoaderData;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Track your application pipeline from discovery to offer.
        </p>
      </div>

      {/* Application Funnel */}
      <FunnelChart stages={data.funnel.funnelStages} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conversion Rates */}
        <ConversionRatesCard rates={data.funnel.conversionRates} />

        {/* Average Time in Stage */}
        <TimeInStageCard stages={data.funnel.averageTimeInStage} />
      </div>

      {/* Top Companies */}
      <TopCompaniesTable companies={data.funnel.topCompanies} />

      {/* Score Correlation Analysis */}
      <ScoreCorrelationCard data={data.scoreCorrelation} />

      {/* Company/Source Effectiveness */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CompanyResponseCard companies={data.sourceEffectiveness.topCompaniesByResponse} />
        <SourceQualityCard sources={data.sourceEffectiveness.sourceMetrics} />
      </div>

      {/* Resume Variant Performance */}
      <ResumeVariantCard data={data.resumeVariants} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Application Funnel (horizontal bar chart)
// ---------------------------------------------------------------------------

function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  // Separate pipeline stages from terminal stages
  const pipelineStages = stages.filter((s) => s.stage !== 'rejected' && s.stage !== 'withdrawn');
  const terminalStages = stages.filter((s) => s.stage === 'rejected' || s.stage === 'withdrawn');

  const totalApps = stages.reduce((sum, s) => sum + s.count, 0);

  if (totalApps === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Application Funnel</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
          <Plane className="mb-3 h-12 w-12 opacity-20" />
          <p className="text-sm">No applications yet. Start applying to see your funnel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-6 flex items-center gap-2">
        <BarChart3 className="text-muted-foreground h-5 w-5" />
        <h2 className="font-semibold">Application Funnel</h2>
        <span className="text-muted-foreground ml-auto text-sm">
          {totalApps} total application{totalApps !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Pipeline stages */}
      <div className="space-y-3">
        {pipelineStages.map((stage) => (
          <FunnelBar key={stage.stage} stage={stage} maxCount={maxCount} />
        ))}
      </div>

      {/* Terminal stages (rejected/withdrawn) */}
      {terminalStages.length > 0 && terminalStages.some((s) => s.count > 0) && (
        <div className="mt-6 border-t pt-4">
          <p className="text-muted-foreground mb-3 text-xs font-medium">Closed</p>
          <div className="space-y-3">
            {terminalStages
              .filter((s) => s.count > 0)
              .map((stage) => (
                <FunnelBar key={stage.stage} stage={stage} maxCount={maxCount} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelBar({ stage, maxCount }: { stage: FunnelStage; maxCount: number }) {
  const label = stageLabels[stage.stage] ?? stage.stage;
  const color = stageColors[stage.stage] ?? 'bg-zinc-400';
  const widthPercent = Math.max((stage.count / maxCount) * 100, 2);

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-right text-xs font-medium">{label}</span>
      <div className="bg-muted h-7 flex-1 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${color} flex items-center justify-end pr-2 transition-all`}
          style={{ width: `${widthPercent}%`, minWidth: '2rem' }}
        >
          {stage.count > 0 && (
            <span className="text-[11px] font-semibold text-white drop-shadow-sm">
              {stage.count}
            </span>
          )}
        </div>
      </div>
      <span className="text-muted-foreground w-10 text-right text-xs">{stage.percentage}%</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion Rates Card
// ---------------------------------------------------------------------------

function ConversionRatesCard({ rates }: { rates: ConversionRate[] }) {
  if (rates.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Conversion Rates</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <TrendingUp className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">Conversion data will appear as applications progress.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="text-muted-foreground h-5 w-5" />
        <h2 className="font-semibold">Conversion Rates</h2>
      </div>
      <div className="space-y-3">
        {rates.map((rate) => {
          const fromLabel = stageLabels[rate.from] ?? rate.from;
          const toLabel = stageLabels[rate.to] ?? rate.to;
          const rateColor =
            rate.rate >= 60
              ? 'text-emerald-600'
              : rate.rate >= 30
                ? 'text-amber-800'
                : 'text-red-500';

          return (
            <div key={`${rate.from}-${rate.to}`} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-right text-xs font-medium">
                {fromLabel}
              </span>
              <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="w-28 shrink-0 truncate text-xs font-medium">{toLabel}</span>
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${
                    rate.rate >= 60
                      ? 'bg-emerald-500'
                      : rate.rate >= 30
                        ? 'bg-amber-500'
                        : 'bg-red-400'
                  }`}
                  style={{ width: `${rate.rate}%` }}
                />
              </div>
              <span className={`w-10 text-right text-xs font-bold ${rateColor}`}>{rate.rate}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Average Time in Stage Card
// ---------------------------------------------------------------------------

function TimeInStageCard({ stages }: { stages: AverageTimeInStage[] }) {
  if (stages.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Average Time in Stage</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <Clock className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">Timing data will appear as applications advance.</p>
        </div>
      </div>
    );
  }

  const maxDays = Math.max(...stages.map((s) => s.avgDays), 1);

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="text-muted-foreground h-5 w-5" />
        <h2 className="font-semibold">Average Time in Stage</h2>
      </div>
      <div className="space-y-3">
        {stages.map((stage) => {
          const label = stageLabels[stage.stage] ?? stage.stage;
          const color = stageColors[stage.stage] ?? 'bg-zinc-400';
          const widthPercent = Math.max((stage.avgDays / maxDays) * 100, 4);

          return (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-right text-xs font-medium">{label}</span>
              <div className="bg-muted h-5 flex-1 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <span className="w-16 text-right text-xs font-semibold">{stage.avgDays}d avg</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top Companies Table
// ---------------------------------------------------------------------------

function TopCompaniesTable({ companies }: { companies: TopCompany[] }) {
  if (companies.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Top Companies</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <Building2 className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">Company analytics will appear once you start applying.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="text-muted-foreground h-5 w-5" />
        <h2 className="font-semibold">Top Companies</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="text-muted-foreground pb-3 font-medium">Company</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Applications</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Advance Rate</th>
              <th className="text-muted-foreground pb-3 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.map((company) => (
              <tr key={company.company}>
                <td className="py-3 font-medium">{company.company}</td>
                <td className="py-3 text-center">{company.count}</td>
                <td className="py-3 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      company.advanceRate >= 50
                        ? 'border border-emerald-300 bg-white text-emerald-700'
                        : company.advanceRate >= 25
                          ? 'border border-amber-300 bg-white text-amber-900'
                          : 'text-muted-foreground border-border border bg-white'
                    }`}
                  >
                    {company.advanceRate}%
                  </span>
                </td>
                <td className="py-3">
                  <div className="bg-muted h-2 w-full max-w-[120px] overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full transition-all ${
                        company.advanceRate >= 50
                          ? 'bg-emerald-500'
                          : company.advanceRate >= 25
                            ? 'bg-amber-500'
                            : 'bg-zinc-400'
                      }`}
                      style={{ width: `${company.advanceRate}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Correlation Analysis
// ---------------------------------------------------------------------------

function ScoreCorrelationCard({ data }: { data: ScoreCorrelationAnalytics }) {
  if (data.totalCount === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <Target className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Score Correlation Analysis</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <Target className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">
            Score correlation data will appear once applications have scores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Score Correlation Analysis</h2>
        </div>
        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <span>
            {data.successfulCount} successful / {data.totalCount} total
          </span>
        </div>
      </div>

      <p className="text-muted-foreground mb-4 text-xs">
        Comparing average scores for applications that reached interview/offer stages vs all
        applications.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Fit Dimensions */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-sky-600">Fit Scores</h3>
          <ScoreDimensionTable dimensions={data.fitDimensions} />
        </div>

        {/* Competitiveness Dimensions */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-violet-600">Competitiveness Scores</h3>
          <ScoreDimensionTable dimensions={data.competitivenessDimensions} />
        </div>
      </div>
    </div>
  );
}

function ScoreDimensionTable({ dimensions }: { dimensions: ScoreDimension[] }) {
  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="text-muted-foreground flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider">
        <span className="flex-1">Dimension</span>
        <span className="w-14 text-right">Success</span>
        <span className="w-14 text-right">All</span>
        <span className="w-14 text-right">Delta</span>
      </div>

      {dimensions.map((dim) => {
        const isPositiveDelta = dim.delta > 0;
        const isSignificant = Math.abs(dim.delta) >= 5;
        // For gapPenalty, lower is better for successful apps, so invert the highlight logic
        const isGapPenalty = dim.dimension === 'gapPenalty';
        const highlightPositive = isGapPenalty ? !isPositiveDelta : isPositiveDelta;

        return (
          <div
            key={dim.dimension}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
              isSignificant && highlightPositive
                ? 'bg-emerald-50'
                : isSignificant && !highlightPositive
                  ? 'bg-red-50'
                  : ''
            }`}
          >
            <span className="flex-1 truncate text-xs">{dim.label}</span>
            <span className="w-14 text-right text-xs font-semibold">{dim.successfulAvg}</span>
            <span className="text-muted-foreground w-14 text-right text-xs">{dim.allAvg}</span>
            <span
              className={`flex w-14 items-center justify-end gap-0.5 text-right text-xs font-bold ${
                highlightPositive && isSignificant
                  ? 'text-emerald-600'
                  : !highlightPositive && isSignificant
                    ? 'text-red-500'
                    : 'text-muted-foreground'
              }`}
            >
              {isPositiveDelta ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : dim.delta < 0 ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : null}
              {dim.delta > 0 ? '+' : ''}
              {dim.delta}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Company Response Rate Card
// ---------------------------------------------------------------------------

function CompanyResponseCard({ companies }: { companies: CompanyEffectiveness[] }) {
  if (companies.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Company Response Rates</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <Building2 className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">Response rate data will appear as applications progress.</p>
        </div>
      </div>
    );
  }

  const maxApps = Math.max(...companies.map((c) => c.totalApplications), 1);

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="text-muted-foreground h-5 w-5" />
        <h2 className="font-semibold">Company Response Rates</h2>
      </div>
      <p className="text-muted-foreground mb-4 text-xs">
        Companies ranked by percentage of applications that advanced past the applied stage.
      </p>
      <div className="space-y-3">
        {companies.map((company) => (
          <div key={company.company} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="max-w-[60%] truncate font-medium">{company.company}</span>
              <span className="text-muted-foreground">
                {company.advancedApplications}/{company.totalApplications} advanced
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-muted h-4 flex-1 overflow-hidden rounded-full">
                {/* Background bar showing total applications proportionally */}
                <div
                  className={`h-full rounded-full transition-all ${
                    company.responseRate >= 50
                      ? 'bg-emerald-500'
                      : company.responseRate >= 25
                        ? 'bg-amber-500'
                        : company.responseRate > 0
                          ? 'bg-sky-500'
                          : 'bg-muted-foreground/30'
                  }`}
                  style={{ width: `${Math.max(company.responseRate, 2)}%` }}
                />
              </div>
              <span
                className={`w-10 text-right text-xs font-bold ${
                  company.responseRate >= 50
                    ? 'text-emerald-600'
                    : company.responseRate >= 25
                      ? 'text-amber-800'
                      : 'text-muted-foreground'
                }`}
              >
                {company.responseRate}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Quality Card
// ---------------------------------------------------------------------------

function SourceQualityCard({ sources }: { sources: SourceEffectiveness[] }) {
  if (sources.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Source Effectiveness</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <Globe className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">Source metrics will appear once jobs are ingested from sources.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-4 flex items-center gap-2">
        <Globe className="text-muted-foreground h-5 w-5" />
        <h2 className="font-semibold">Source Effectiveness</h2>
      </div>
      <p className="text-muted-foreground mb-4 text-xs">
        Job sources ranked by average quality score and interview conversion.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="text-muted-foreground pb-3 font-medium">Source</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Jobs</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Apps</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Interviews</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Avg Score</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sources.map((source) => (
              <tr key={source.sourceId}>
                <td className="py-3 font-medium">{source.sourceName}</td>
                <td className="py-3 text-center">{source.jobCount}</td>
                <td className="py-3 text-center">{source.applicationCount}</td>
                <td className="py-3 text-center">{source.interviewCount}</td>
                <td className="py-3 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                      source.avgScore >= 75
                        ? 'border border-emerald-300 bg-white text-emerald-700'
                        : source.avgScore >= 50
                          ? 'border border-amber-300 bg-white text-amber-900'
                          : 'text-muted-foreground border-border border bg-white'
                    }`}
                  >
                    {source.avgScore}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div className="bg-muted h-2 w-16 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${
                          source.conversionRate >= 50
                            ? 'bg-emerald-500'
                            : source.conversionRate >= 25
                              ? 'bg-amber-500'
                              : 'bg-sky-400'
                        }`}
                        style={{ width: `${Math.max(source.conversionRate, 3)}%` }}
                      />
                    </div>
                    <span className="w-8 text-xs font-semibold">{source.conversionRate}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resume Variant Performance Card
// ---------------------------------------------------------------------------

function ResumeVariantCard({ data }: { data: ResumeVariantAnalytics }) {
  if (data.variants.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-6 shadow">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Resume Variant Performance</h2>
        </div>
        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <FileText className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm">
            Resume performance data will appear once tailored resumes are used in applications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6 shadow">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="text-muted-foreground h-5 w-5" />
          <h2 className="font-semibold">Resume Variant Performance</h2>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{data.summary.totalVariants}</div>
          <div className="text-muted-foreground text-xs">Variants Used</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {data.summary.successfulVariants}
          </div>
          <div className="text-muted-foreground text-xs">Led to Interview+</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{data.summary.successRate}%</div>
          <div className="text-muted-foreground text-xs">Success Rate</div>
        </div>
      </div>

      {/* Success rate bar */}
      {data.summary.totalVariants > 0 && (
        <div className="mb-6">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
            <span>Overall success rate</span>
            <span>{data.summary.successRate}%</span>
          </div>
          <div className="bg-muted h-3 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${
                data.summary.successRate >= 50
                  ? 'bg-emerald-500'
                  : data.summary.successRate >= 25
                    ? 'bg-amber-500'
                    : 'bg-sky-400'
              }`}
              style={{ width: `${Math.max(data.summary.successRate, 2)}%` }}
            />
          </div>
        </div>
      )}

      {/* Variants table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="text-muted-foreground pb-3 font-medium">Company</th>
              <th className="text-muted-foreground pb-3 font-medium">Position</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Version</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Status</th>
              <th className="text-muted-foreground pb-3 text-center font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.variants.map((variant) => {
              const statusLabel =
                stageLabels[variant.applicationStatus] ?? variant.applicationStatus;

              return (
                <tr key={variant.resumeId}>
                  <td className="py-3 font-medium">{variant.company}</td>
                  <td className="text-muted-foreground max-w-[200px] truncate py-3">
                    {variant.jobTitle}
                  </td>
                  <td className="py-3 text-center">
                    <span className="bg-muted inline-block rounded px-2 py-0.5 font-mono text-xs">
                      v{variant.version}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        stageBadgeColors[variant.applicationStatus] ??
                        'text-muted-foreground border-border border bg-white'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    {variant.applicationStatus === 'no_application' ? (
                      <span className="text-muted-foreground text-xs">--</span>
                    ) : variant.isSuccessful ? (
                      <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="text-muted-foreground/40 mx-auto h-4 w-4" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
