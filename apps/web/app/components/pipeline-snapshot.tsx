import * as React from 'react';
import { ArrowRight, BarChart3, DollarSign, TrendingDown } from 'lucide-react';
import { Badge } from '@job-pilot/ui';

interface PipelineData {
  funnel: {
    applied: number;
    screen: number;
    interview: number;
    offer: number;
  };
  rejectionStats: {
    avgDays: number;
    fastest: number;
    count: number;
  };
  compSummary: {
    minSalary: number | null;
    maxSalary: number | null;
    withEquity: number;
    avgMidpoint: number | null;
  };
}

function formatSalary(amount: number | null): string {
  if (amount == null) return '\u2014';
  if (amount >= 1000) return `$${Math.round(amount / 1000)}k`;
  return `$${amount}`;
}

const FUNNEL_STAGES = [
  { key: 'applied', label: 'Applied', color: 'bg-sky-500' },
  { key: 'screen', label: 'Screen', color: 'bg-blue-500' },
  { key: 'interview', label: 'Interview', color: 'bg-indigo-500' },
  { key: 'offer', label: 'Offer', color: 'bg-emerald-500' },
] as const;

function ConversionFunnel({ funnel }: { funnel: PipelineData['funnel'] }) {
  const stages = FUNNEL_STAGES.map((stage) => ({
    ...stage,
    count: funnel[stage.key],
  }));

  const maxCount = Math.max(stages[0].count, 1);

  return (
    <div className="bg-card/50 rounded-lg border p-4">
      <h3 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
        <BarChart3 className="h-4 w-4 text-sky-500" />
        Pipeline Funnel
      </h3>
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const prevCount = i > 0 ? stages[i - 1].count : null;
          const conversionPct =
            prevCount != null && prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : null;
          const barWidth = Math.max((stage.count / maxCount) * 100, 4);

          return (
            <React.Fragment key={stage.key}>
              {i > 0 && (
                <div className="text-muted-foreground flex items-center gap-1 pl-1">
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-[10px]">{conversionPct}% conversion</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-16 shrink-0 text-xs">{stage.label}</span>
                <div className="bg-muted/40 h-6 flex-1 overflow-hidden rounded">
                  <div
                    className={`h-full ${stage.color} flex items-center justify-end rounded pr-2 transition-all duration-300`}
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-[10px] font-semibold text-white">{stage.count}</span>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function RejectionInsights({ rejectionStats }: { rejectionStats: PipelineData['rejectionStats'] }) {
  const items = [
    {
      label: 'Avg days to rejection',
      value: rejectionStats.avgDays > 0 ? `${rejectionStats.avgDays} days` : '\u2014',
    },
    {
      label: 'Fastest rejection',
      value: rejectionStats.fastest > 0 ? `${rejectionStats.fastest} days` : '\u2014',
    },
    {
      label: 'Total rejections',
      value: String(rejectionStats.count),
    },
  ];

  return (
    <div className="bg-card/50 rounded-lg border p-4">
      <h3 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
        <TrendingDown className="h-4 w-4 text-red-500" />
        Rejection Insights
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{item.label}</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {item.value}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompensationOverview({ compSummary }: { compSummary: PipelineData['compSummary'] }) {
  const salaryRange =
    compSummary.minSalary != null && compSummary.maxSalary != null
      ? `${formatSalary(compSummary.minSalary)} \u2013 ${formatSalary(compSummary.maxSalary)}`
      : 'No data';

  const items = [
    {
      label: 'Salary range',
      value: salaryRange,
    },
    {
      label: 'Roles with equity',
      value: `${compSummary.withEquity} roles`,
    },
    {
      label: 'Avg midpoint',
      value: formatSalary(compSummary.avgMidpoint),
    },
  ];

  return (
    <div className="bg-card/50 rounded-lg border p-4">
      <h3 className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
        <DollarSign className="h-4 w-4 text-emerald-500" />
        Compensation Overview
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">{item.label}</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {item.value}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelineSnapshot({ data }: { data: PipelineData }) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground flex items-center gap-2 text-base font-semibold">
        <BarChart3 className="h-5 w-5 text-sky-500" />
        Pipeline Snapshot
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ConversionFunnel funnel={data.funnel} />
        <RejectionInsights rejectionStats={data.rejectionStats} />
        <CompensationOverview compSummary={data.compSummary} />
      </div>
    </section>
  );
}
