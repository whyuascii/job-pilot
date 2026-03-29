import React from 'react';

import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  ArrowRight,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardList,
  MapPin,
  Plane,
  Trash2,
  X,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Separator,
  Skeleton,
  StatusBadge,
  statusLabels,
} from '@job-pilot/ui';

import { api } from '~/lib/api-client';

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function ApplicationsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-80" />
        </div>
        <div className="flex items-center gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-20 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route definition with loader
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/applications')({
  loader: () => api.applications.list(),
  component: ApplicationsPage,
  pendingComponent: ApplicationsSkeleton,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Application = Awaited<ReturnType<typeof api.applications.list>>[number];

type ApplicationStatus =
  | 'discovered'
  | 'shortlisted'
  | 'resume_generated'
  | 'applied'
  | 'recruiter_screen'
  | 'technical'
  | 'onsite'
  | 'final'
  | 'rejected'
  | 'offer'
  | 'withdrawn';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

interface TabDef {
  label: string;
  statuses: ApplicationStatus[] | null; // null = all
}

const TABS: TabDef[] = [
  { label: 'All', statuses: null },
  { label: 'Saved', statuses: ['discovered', 'shortlisted'] },
  { label: 'Applied', statuses: ['resume_generated', 'applied'] },
  { label: 'Interviewing', statuses: ['recruiter_screen', 'technical', 'onsite', 'final'] },
  { label: 'Offers', statuses: ['offer'] },
  { label: 'Closed', statuses: ['rejected', 'withdrawn'] },
];

// ---------------------------------------------------------------------------
// All valid statuses (for free movement between any stage)
// ---------------------------------------------------------------------------

const ALL_STATUSES: ApplicationStatus[] = [
  'discovered',
  'shortlisted',
  'resume_generated',
  'applied',
  'recruiter_screen',
  'technical',
  'onsite',
  'final',
  'offer',
  'rejected',
  'withdrawn',
];

// Statuses that have passed the "applied" threshold
const APPLIED_STATUSES: ApplicationStatus[] = [
  'applied',
  'recruiter_screen',
  'technical',
  'onsite',
  'final',
  'offer',
  'rejected',
  'withdrawn',
];

// ---------------------------------------------------------------------------
// Pipeline column definitions (for the kanban-style view)
// ---------------------------------------------------------------------------

interface PipelineColumn {
  title: string;
  statuses: ApplicationStatus[];
}

const PIPELINE_COLUMNS: PipelineColumn[] = [
  { title: 'Saved', statuses: ['discovered', 'shortlisted'] },
  { title: 'Applied', statuses: ['resume_generated', 'applied'] },
  { title: 'Interviewing', statuses: ['recruiter_screen', 'technical', 'onsite', 'final'] },
  { title: 'Results', statuses: ['offer', 'rejected', 'withdrawn'] },
];

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

const ITEMS_PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(date: string | Date | null): string {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString();
}

function formatCompensation(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => {
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

// ---------------------------------------------------------------------------
// ApplicationCard
// ---------------------------------------------------------------------------

function ApplicationCard({
  app,
  onRequestDelete,
}: {
  app: Application;
  onRequestDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [changing, setChanging] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const status = app.status as ApplicationStatus;
  const isApplied = APPLIED_STATUSES.includes(status);
  const availableStatuses = ALL_STATUSES.filter((s) => s !== status);

  async function handleStatusChange(newStatus: ApplicationStatus) {
    setLoading(true);
    try {
      await api.applications.updateStatus({
        applicationId: app.id,
        status: newStatus,
      });
      router.invalidate();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setLoading(false);
      setChanging(false);
    }
  }

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Job info */}
          <div className="min-w-0 flex-1 space-y-1">
            {app.job?.id ? (
              <Link
                to="/jobs/$jobId"
                params={{ jobId: app.job.id }}
                className="hover:text-primary truncate font-semibold leading-tight transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {app.job.title}
              </Link>
            ) : (
              <p className="truncate font-semibold leading-tight">Unknown Position</p>
            )}
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{app.job?.company ?? 'Unknown Company'}</span>
            </div>
            {app.job?.location && (
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{app.job.location}</span>
                {app.job.remotePolicy && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                    {app.job.remotePolicy}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Right: Status + date */}
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={status} />
            {isApplied && app.appliedAt && (
              <div className="text-muted-foreground flex items-center gap-1 text-xs">
                <Calendar className="h-3 w-3" />
                <span>{timeAgo(app.appliedAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Compensation info */}
        {app.job && formatCompensation(app.job.compensationMin, app.job.compensationMax) && (
          <p className="text-muted-foreground mt-2 text-xs font-medium">
            {formatCompensation(app.job.compensationMin, app.job.compensationMax)}
          </p>
        )}

        {/* Status change controls -- free movement to any stage */}
        <div className="mt-3 border-t pt-3">
          {!changing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 flex-1 justify-between text-xs"
                onClick={() => setChanging(true)}
                disabled={loading}
              >
                <span>Change Status</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-7 w-7"
                onClick={() => onRequestDelete(app.id)}
                aria-label="Remove application"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium">Move to:</p>
              <div className="flex flex-wrap gap-1.5">
                {availableStatuses.map((ns) => (
                  <Button
                    key={ns}
                    variant={
                      ns === 'rejected' || ns === 'withdrawn'
                        ? 'outline'
                        : ns === 'offer'
                          ? 'default'
                          : 'secondary'
                    }
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleStatusChange(ns)}
                    disabled={loading}
                  >
                    {statusLabels[ns] ?? ns}
                    {ns !== 'rejected' && ns !== 'withdrawn' && (
                      <ArrowRight className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 text-xs"
                  onClick={() => setChanging(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PipelineView (horizontal kanban-style)
// ---------------------------------------------------------------------------

function PipelineView({
  applications,
  onRequestDelete,
}: {
  applications: Application[];
  onRequestDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {PIPELINE_COLUMNS.map((col) => {
        const colApps = applications.filter((a) =>
          col.statuses.includes(a.status as ApplicationStatus),
        );
        return (
          <div key={col.title} className="bg-muted/30 flex flex-col rounded-xl border">
            {/* Column header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <Badge variant="secondary" className="text-xs">
                {colApps.length}
              </Badge>
            </div>
            {/* Column body */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3" style={{ maxHeight: '60vh' }}>
              {colApps.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-xs">No applications</p>
              ) : (
                colApps.map((app) => (
                  <ApplicationCard key={app.id} app={app} onRequestDelete={onRequestDelete} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListView (tab-filtered list)
// ---------------------------------------------------------------------------

function ListView({
  applications,
  activeTab,
  onRequestDelete,
}: {
  applications: Application[];
  activeTab: string;
  onRequestDelete: (id: string) => void;
}) {
  const [visibleCount, setVisibleCount] = React.useState(ITEMS_PER_PAGE);

  const tab = TABS.find((t) => t.label === activeTab) ?? TABS[0];
  const filtered = tab.statuses
    ? applications.filter((a) => tab.statuses!.includes(a.status as ApplicationStatus))
    : applications;

  // Reset visible count when tab changes
  React.useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeTab]);

  const visibleApps = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  if (filtered.length === 0) {
    return (
      <div className="bg-card flex flex-col items-center justify-center rounded-xl border py-16 shadow">
        <Plane className="text-muted-foreground/20 mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">No applications in this category.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        Showing {visibleApps.length} of {filtered.length} application
        {filtered.length !== 1 ? 's' : ''}
      </p>
      {visibleApps.map((app) => (
        <ApplicationCard key={app.id} app={app} onRequestDelete={onRequestDelete} />
      ))}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
          >
            Show More
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

type ViewMode = 'list' | 'pipeline';

function ApplicationsPage() {
  const applications = Route.useLoaderData();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('All');
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const deletingApp = React.useMemo(
    () => (deletingId ? applications.find((a: Application) => a.id === deletingId) : null),
    [deletingId, applications],
  );

  const handleDelete = async (applicationId: string) => {
    setDeletingId(null);
    await api.applications.delete({ applicationId });
    router.invalidate();
  };

  // Empty state
  if (!applications || applications.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flight Log</h1>
          <p className="text-muted-foreground">
            Track your applications through every stage of the journey.
          </p>
        </div>

        <div className="bg-card flex flex-col items-center justify-center rounded-xl border py-20 shadow">
          <ClipboardList className="text-muted-foreground/20 mb-4 h-16 w-16" />
          <h3 className="mb-1 text-lg font-semibold">No flights logged</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-center text-sm">
            Start applying to jobs to see your application pipeline here. Browse available
            opportunities to get started.
          </p>
          <Button asChild>
            <Link to="/jobs">
              <Plane className="mr-2 h-4 w-4" />
              Browse Jobs
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Summary stats
  const totalCount = applications.length;
  const activeCount = applications.filter(
    (a) => !['rejected', 'withdrawn', 'offer'].includes(a.status),
  ).length;
  const offerCount = applications.filter((a) => a.status === 'offer').length;

  return (
    <div className="space-y-6">
      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Application?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              {deletingApp
                ? `"${deletingApp.job?.title ?? 'this application'}" at ${deletingApp.job?.company ?? 'unknown company'}`
                : 'this application'}{' '}
              from your flight log. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flight Log</h1>
          <p className="text-muted-foreground">
            Track your applications through every stage of the journey.
          </p>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-3">
          <div className="bg-card rounded-lg border px-3 py-1.5 text-center shadow-sm">
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="text-lg font-bold">{totalCount}</p>
          </div>
          <div className="bg-card rounded-lg border px-3 py-1.5 text-center shadow-sm">
            <p className="text-muted-foreground text-xs">Active</p>
            <p className="text-lg font-bold text-blue-600">{activeCount}</p>
          </div>
          {offerCount > 0 && (
            <div className="bg-card rounded-lg border px-3 py-1.5 text-center shadow-sm">
              <p className="text-muted-foreground text-xs">Offers</p>
              <p className="text-lg font-bold text-emerald-600">{offerCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* View toggle + tab filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.label;
            const count = tab.statuses
              ? applications.filter((a) => tab.statuses!.includes(a.status as ApplicationStatus))
                  .length
              : applications.length;
            return (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                {tab.label}
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex shrink-0 items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('pipeline')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'pipeline'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pipeline
          </button>
        </div>
      </div>

      <Separator />

      {/* Content */}
      {viewMode === 'pipeline' ? (
        <PipelineView applications={applications} onRequestDelete={setDeletingId} />
      ) : (
        <ListView
          applications={applications}
          activeTab={activeTab}
          onRequestDelete={setDeletingId}
        />
      )}
    </div>
  );
}
