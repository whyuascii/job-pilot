import * as React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Clock,
  Compass,
  Plane,
  TrendingDown,
  User,
} from 'lucide-react';
import { Badge, Button, Skeleton } from '@job-pilot/ui';
import { ActiveMissions } from '~/components/active-missions';
import { ActivityFeed } from '~/components/activity-feed';
import { PipelineSnapshot } from '~/components/pipeline-snapshot';
import { QuickAddForm } from '~/components/quick-add-form';
import { api } from '~/lib/api-client';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <div className="lg:col-span-2">
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    return api.dashboard.getControlTower();
  },
  component: ControlTowerPage,
  pendingComponent: DashboardSkeleton,
});

function ControlTowerPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  async function handleActivityConfirm(
    itemId: string,
    itemType: string,
    action: string,
    actionData?: any,
  ) {
    await api.activity.confirm({ action, itemId, itemType, data: actionData });
    router.invalidate();
  }

  async function handleQuickAdd(formData: any) {
    await api.applications.quickAdd({
      company: formData.company,
      jobTitle: formData.jobTitle || undefined,
      dateApplied: formData.dateApplied || undefined,
      compMin: formData.compMin ? Number(formData.compMin) : undefined,
      compMax: formData.compMax ? Number(formData.compMax) : undefined,
      equityDetails: formData.equityDetails || undefined,
      source: formData.source || undefined,
      status: formData.status || undefined,
      statusNote: formData.statusNote || undefined,
    });
    router.invalidate();
  }

  const hasData = data.summary.total > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control Tower</h1>
          <p className="text-muted-foreground">Your job search command center.</p>
        </div>
        <EmptyDashboard onQuickAdd={() => setQuickAddOpen(true)} />
        <QuickAddForm
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onSubmit={handleQuickAdd}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Control Tower</h1>
        <p className="text-muted-foreground">Your job search command center.</p>
      </div>

      {/* Section 1: Job Search Summary Bar */}
      <SummaryBar summary={data.summary} />

      {/* Section 2+3: Active Missions + Activity Feed */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ActiveMissions missions={data.activeMissions} />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed
            items={data.activityFeed}
            onConfirm={handleActivityConfirm}
            onQuickAdd={() => setQuickAddOpen(true)}
          />
        </div>
      </div>

      {/* Section 4: Pipeline Snapshot */}
      <PipelineSnapshot data={data.pipeline} />

      {/* Quick Add Form */}
      <QuickAddForm
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSubmit={handleQuickAdd}
      />
    </div>
  );
}

function SummaryBar({ summary }: { summary: any }) {
  const startDate = summary.searchStartDate
    ? new Date(summary.searchStartDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="bg-card rounded-xl border p-4 shadow">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Date range */}
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          {startDate ? (
            <span>
              {startDate} — {today}{' '}
              <span className="text-foreground font-medium">{summary.searchDays}d</span>
            </span>
          ) : (
            <span>Starting today</span>
          )}
        </div>

        {/* Divider */}
        <div className="bg-border hidden h-6 w-px sm:block" />

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4">
          <SummaryStat value={summary.total} label="Total" className="text-foreground" />
          <SummaryStat value={summary.pending} label="Pending" className="text-amber-600" />
          <SummaryStat value={summary.rejected} label="Rejected" className="text-red-500" />
          <SummaryStat value={summary.inProgress} label="In Progress" className="text-sky-600" />
          <SummaryStat
            value={summary.declined}
            label="Declined"
            className="text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <Link
      to="/applications"
      className="group flex items-baseline gap-1.5 transition-opacity hover:opacity-80"
    >
      <span className={`text-xl font-bold ${className}`}>{value}</span>
      <span className="text-muted-foreground text-xs group-hover:underline">{label}</span>
    </Link>
  );
}

function EmptyDashboard({ onQuickAdd }: { onQuickAdd: () => void }) {
  return (
    <div className="bg-card rounded-xl border p-10 shadow">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-50">
          <Plane className="h-8 w-8 text-sky-500" />
        </div>
        <h2 className="mb-1 text-lg font-semibold">Welcome to Control Tower</h2>
        <p className="text-muted-foreground mb-6 max-w-md text-sm">
          Your job search command center will come alive as you track applications. Get started by
          adding your first job or logging an external application.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button variant="default" size="sm" className="w-full gap-2" onClick={onQuickAdd}>
            <Plane className="h-3.5 w-3.5" />
            Quick Add Application
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
            <Link to="/profile">
              <User className="h-3.5 w-3.5" />
              Set up your Pilot Profile
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
            <Link to="/jobs">
              <Compass className="h-3.5 w-3.5" />
              Add your first job
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
            <Link to="/answers">
              <BookOpen className="h-3.5 w-3.5" />
              Record reusable answers
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
