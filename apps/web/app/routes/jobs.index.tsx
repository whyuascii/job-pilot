import * as React from 'react';

import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowUpDown,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Globe,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Plane,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@job-pilot/ui';

import { api } from '~/lib/api-client';
import type { JobListParams, JobListResult } from '~/lib/api-client';
import { captureEvent } from '~/lib/posthog';

function JobsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="mt-2.5 h-5 w-72 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-5 w-48 rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card space-y-3 rounded-xl border p-6">
            <div className="flex justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-64 rounded-md" />
                <Skeleton className="h-4 w-40 rounded-md" />
              </div>
              <Skeleton className="h-16 w-16 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type JobSearch = {
  q?: string;
  remote?: string;
  minScore?: number;
  recommendation?: string;
  hasScore?: 'scored' | 'unscored';
  employmentType?: string;
  minComp?: number;
  maxComp?: number;
  domain?: string;
  sponsorship?: string;
  minYears?: number;
  maxYears?: number;
  postedAfter?: string;
  sortBy?: 'score' | 'date' | 'company' | 'title';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export const Route = createFileRoute('/jobs/')({
  validateSearch: (search: Record<string, unknown>): JobSearch => ({
    q: typeof search.q === 'string' ? search.q : undefined,
    remote: typeof search.remote === 'string' ? search.remote : undefined,
    minScore: typeof search.minScore === 'number' ? search.minScore : undefined,
    recommendation: typeof search.recommendation === 'string' ? search.recommendation : undefined,
    hasScore:
      search.hasScore === 'scored' || search.hasScore === 'unscored' ? search.hasScore : undefined,
    employmentType: typeof search.employmentType === 'string' ? search.employmentType : undefined,
    minComp: typeof search.minComp === 'number' ? search.minComp : undefined,
    maxComp: typeof search.maxComp === 'number' ? search.maxComp : undefined,
    domain: typeof search.domain === 'string' ? search.domain : undefined,
    sponsorship: typeof search.sponsorship === 'string' ? search.sponsorship : undefined,
    minYears: typeof search.minYears === 'number' ? search.minYears : undefined,
    maxYears: typeof search.maxYears === 'number' ? search.maxYears : undefined,
    postedAfter: typeof search.postedAfter === 'string' ? search.postedAfter : undefined,
    sortBy: ['score', 'date', 'company', 'title'].includes(search.sortBy as string)
      ? (search.sortBy as JobSearch['sortBy'])
      : undefined,
    sortDir: search.sortDir === 'asc' || search.sortDir === 'desc' ? search.sortDir : undefined,
    page: typeof search.page === 'number' ? search.page : undefined,
    pageSize: typeof search.pageSize === 'number' ? search.pageSize : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [jobsResult, sources, profileSkills, candidate, applications, presets] =
      await Promise.all([
        api.jobs.list(deps),
        api.settings.listJobSources().catch(() => []),
        api.skills.list().catch(() => []),
        api.candidates.get().catch(() => null),
        api.applications.list().catch(() => []),
        api.preferences.listByCategory('job_filter_preset').catch(() => []),
      ]);
    return { jobsResult, sources, profileSkills, candidate, applications, presets };
  },
  component: JobsPage,
  pendingComponent: JobsSkeleton,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCompensation(
  min: number | null,
  max: number | null,
  currency: string | null,
  type: string,
) {
  if (!min && !max) return null;
  const c = currency || 'USD';
  const fmt = (n: number) => {
    if (n >= 1000) return `${c === 'USD' ? '$' : c}${Math.round(n / 1000)}k`;
    return `${c === 'USD' ? '$' : c}${n}`;
  };
  const range =
    min && max ? `${fmt(min)} - ${fmt(max)}` : min ? `${fmt(min)}+` : `Up to ${fmt(max!)}`;
  const suffix = type === 'hourly' ? '/hr' : type === 'contract' ? '/contract' : '/yr';
  return range + suffix;
}

function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getRemotePolicyColor(policy: string | null) {
  switch (policy?.toLowerCase()) {
    case 'remote':
      return 'bg-white text-emerald-700 border-emerald-300';
    case 'hybrid':
      return 'bg-white text-sky-700 border-sky-300';
    case 'onsite':
      return 'bg-white text-foreground border-border';
    default:
      return 'bg-white text-muted-foreground border-border';
  }
}

function getScoreColor(score: number) {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 60) return 'text-sky-600';
  if (score >= 40) return 'text-amber-700';
  return 'text-red-600';
}

function getScoreBg(score: number) {
  if (score >= 75) return 'bg-white border-emerald-300';
  if (score >= 60) return 'bg-white border-sky-300';
  if (score >= 40) return 'bg-white border-amber-300';
  return 'bg-white border-red-300';
}

function getScoreLabel(score: number) {
  if (score >= 75) return 'Strong Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Possible';
  return 'Weak';
}

function getRecommendationVariant(
  rec: string | null,
): 'success' | 'default' | 'warning' | 'destructive' {
  switch (rec) {
    case 'strong_apply':
      return 'success';
    case 'apply':
      return 'default';
    case 'maybe':
      return 'warning';
    case 'skip':
      return 'destructive';
    default:
      return 'secondary' as any;
  }
}

function getRecommendationLabel(rec: string | null) {
  switch (rec) {
    case 'strong_apply':
      return 'Strong Apply';
    case 'apply':
      return 'Apply';
    case 'maybe':
      return 'Maybe';
    case 'skip':
      return 'Skip';
    default:
      return rec ?? '';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Job = JobListResult['items'][number];

// Known source presets
const SOURCE_PRESETS = [
  { name: 'Google Jobs', type: 'serpapi', supportsSearch: true },
  { name: 'LinkedIn', type: 'linkedin', supportsSearch: true },
  { name: 'Indeed', type: 'indeed', supportsSearch: true },
  { name: 'Adzuna', type: 'adzuna', supportsSearch: true },
  { name: 'Glassdoor', type: 'glassdoor', supportsSearch: false },
  { name: 'USAJobs', type: 'usajobs', supportsSearch: false },
  { name: 'Greenhouse', type: 'greenhouse', supportsSearch: false },
  { name: 'Lever', type: 'lever', supportsSearch: false },
  { name: 'Custom', type: 'custom', supportsSearch: false },
] as const;

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function JobsPage() {
  const {
    jobsResult,
    sources: initialSources,
    profileSkills,
    candidate,
    applications,
    presets: initialPresets,
  } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate({ from: '/jobs/' });

  // Local state for text search input (debounced to URL)
  const [localQuery, setLocalQuery] = React.useState(search.q || '');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Sync local query from URL on external navigation
  React.useEffect(() => {
    setLocalQuery(search.q || '');
  }, [search.q]);

  const updateSearch = React.useCallback(
    (updates: Partial<JobSearch>) => {
      navigate({
        search: (prev: any) => {
          const next = { ...prev, ...updates, page: updates.page !== undefined ? updates.page : 1 };
          // Remove undefined/null/empty values to keep URL clean
          for (const key of Object.keys(next)) {
            if (
              next[key] === undefined ||
              next[key] === null ||
              next[key] === '' ||
              next[key] === 0
            ) {
              delete next[key];
            }
          }
          return next;
        },
      });
    },
    [navigate],
  );

  const handleQueryChange = (value: string) => {
    setLocalQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateSearch({ q: value || undefined });
    }, 300);
  };

  // Cleanup debounce on unmount
  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const [showAddForm, setShowAddForm] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);

  // Preset state
  const [presets, setPresets] = React.useState(initialPresets);
  const [presetName, setPresetName] = React.useState('');
  const [savingPreset, setSavingPreset] = React.useState(false);

  React.useEffect(() => {
    setPresets(initialPresets);
  }, [initialPresets]);

  // Source management state
  const [sources, setSources] = React.useState(initialSources);
  const [showSources, setShowSources] = React.useState(false);
  const [showAddSource, setShowAddSource] = React.useState(false);
  const [syncingAll, setSyncingAll] = React.useState(false);
  const [syncingIds, setSyncingIds] = React.useState<Set<string>>(new Set());
  const [syncFeedback, setSyncFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [autoSyncing, setAutoSyncing] = React.useState(false);

  const [lastScanTime, setLastScanTime] = React.useState<Date | null>(() => {
    const times = initialSources
      .filter((s) => s.lastSyncAt)
      .map((s) => new Date(s.lastSyncAt!).getTime());
    return times.length > 0 ? new Date(Math.max(...times)) : null;
  });

  React.useEffect(() => {
    setSources((prev) => {
      const sig = (list: typeof initialSources) =>
        list
          .map((s) => `${s.id}:${s.name}:${s.type}:${s.enabled}:${JSON.stringify(s.config)}`)
          .sort()
          .join('|');
      if (sig(initialSources) !== sig(prev)) return initialSources;
      return prev.map((s) => {
        const incoming = initialSources.find((is) => is.id === s.id);
        if (
          incoming &&
          incoming.lastSyncAt &&
          (!s.lastSyncAt || new Date(incoming.lastSyncAt) > new Date(s.lastSyncAt))
        ) {
          return { ...s, lastSyncAt: incoming.lastSyncAt };
        }
        return s;
      });
    });
  }, [initialSources]);

  // Use server-side data directly
  const jobs = jobsResult.items;
  const totalItems = jobsResult.total;
  const currentPage = jobsResult.page;
  const pageSize = jobsResult.pageSize;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Filter out jobs that already have applications (client-side since apps aren't filtered server-side)
  const appliedJobIds = React.useMemo(
    () => new Set((applications ?? []).map((a: any) => a.jobId).filter(Boolean)),
    [applications],
  );
  const visibleJobs = React.useMemo(
    () => jobs.filter((j: any) => !appliedJobIds.has(j.id)),
    [jobs, appliedJobIds],
  );

  // Profile skill set for matching
  const profileSkillSet = React.useMemo(
    () => new Set(profileSkills.map((s: any) => s.name?.toLowerCase()).filter(Boolean)),
    [profileSkills],
  );

  const jobMatchMap = React.useMemo(() => {
    const map = new Map<string, { matched: string[]; missing: string[]; matchPct: number }>();
    if (profileSkillSet.size === 0) return map;
    for (const job of visibleJobs) {
      const required = [...(job.mustHaveSkills ?? []), ...(job.niceToHaveSkills ?? [])];
      if (required.length === 0) continue;
      const matched: string[] = [];
      const missing: string[] = [];
      for (const skill of required) {
        if (profileSkillSet.has(skill.toLowerCase())) matched.push(skill);
        else missing.push(skill);
      }
      map.set(job.id, {
        matched,
        missing,
        matchPct: Math.round((matched.length / required.length) * 100),
      });
    }
    return map;
  }, [visibleJobs, profileSkillSet]);

  const deletingJob = React.useMemo(
    () => (deletingId ? visibleJobs.find((j: any) => j.id === deletingId) : null),
    [deletingId, visibleJobs],
  );

  const enabledSourceCount = sources.filter(
    (s) => s.enabled && ((s.config as any)?.url || (s.config as any)?.searchTerm),
  ).length;

  // Count active filters (for badge)
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (search.remote) count++;
    if (search.minScore) count++;
    if (search.recommendation) count++;
    if (search.hasScore) count++;
    if (search.employmentType) count++;
    if (search.minComp) count++;
    if (search.maxComp) count++;
    if (search.domain) count++;
    if (search.sponsorship) count++;
    if (search.minYears) count++;
    if (search.maxYears) count++;
    if (search.postedAfter) count++;
    if (search.sortBy && search.sortBy !== 'score') count++;
    return count;
  }, [search]);

  const handleDelete = async (jobId: string) => {
    setDeletingId(null);
    await api.jobs.delete({ jobId });
    router.invalidate();
  };

  const handleSyncAll = React.useCallback(async () => {
    if (syncingAll) return;
    setSyncingAll(true);
    setSyncFeedback(null);
    try {
      const result = await api.settings.syncAllSources();
      const now = new Date().toISOString();
      setSources((prev) =>
        prev.map((s) => (s.enabled && (s.config as any)?.url ? { ...s, lastSyncAt: now } : s)),
      );
      setLastScanTime(new Date());
      setSyncFeedback({
        type: result.totalErrors > 0 ? 'error' : 'success',
        message: `Scanned ${result.results.length} source${result.results.length !== 1 ? 's' : ''}: ${result.totalNewJobs} new job${result.totalNewJobs !== 1 ? 's' : ''} found${result.totalErrors > 0 ? `, ${result.totalErrors} error${result.totalErrors !== 1 ? 's' : ''}` : ''}.`,
      });
      router.invalidate();
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Sync failed.',
      });
    } finally {
      setSyncingAll(false);
      setAutoSyncing(false);
    }
  }, [syncingAll, router]);

  const handleSyncOne = async (sourceId: string) => {
    setSyncingIds((prev) => new Set(prev).add(sourceId));
    try {
      await api.settings.syncJobSource({ sourceId });
      const now = new Date().toISOString();
      setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, lastSyncAt: now } : s)));
      setLastScanTime(new Date());
      router.invalidate();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  const handleToggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      const updated = await api.settings.toggleJobSource({ sourceId, enabled });
      setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, ...updated } : s)));
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await api.settings.deleteJobSource({ sourceId });
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err) {
      console.error('Delete source failed:', err);
    }
  };

  // Presets
  const handleSavePreset = async () => {
    if (!presetName.trim() || savingPreset) return;
    setSavingPreset(true);
    try {
      const { page, pageSize: _ps, ...filters } = search;
      const pref = await api.preferences.add({
        key: presetName.trim(),
        value: JSON.stringify(filters),
        category: 'job_filter_preset',
      });
      setPresets((prev) => [...prev, pref]);
      setPresetName('');
    } catch (err) {
      console.error('Failed to save preset:', err);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleLoadPreset = (preset: any) => {
    try {
      const filters = JSON.parse(preset.value);
      navigate({ search: filters });
    } catch {
      console.error('Invalid preset data');
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    try {
      await api.preferences.delete({ preferenceId: presetId });
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
    } catch (err) {
      console.error('Failed to delete preset:', err);
    }
  };

  // Auto-resync every hour
  React.useEffect(() => {
    if (enabledSourceCount === 0) return;
    const interval = setInterval(
      () => {
        if (!syncingAll) {
          setAutoSyncing(true);
          handleSyncAll();
        }
      },
      60 * 60 * 1000,
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledSourceCount]);

  return (
    <div className="space-y-6">
      {/* Delete Job Confirmation */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{' '}
              {deletingJob ? `"${deletingJob.title}" at ${deletingJob.company}` : 'this job'} from
              your flight plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Plane className="text-primary h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Flight Plan</h1>
              <p className="text-muted-foreground text-sm">
                {totalItems} {totalItems === 1 ? 'opportunity' : 'opportunities'} on your radar
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastScanTime && enabledSourceCount > 0 && (
            <div
              className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex"
              title={lastScanTime.toLocaleString()}
            >
              <Clock className="h-3 w-3" />
              <span>Scanned {timeAgo(lastScanTime)}</span>
              {autoSyncing && (
                <span className="inline-flex items-center gap-1 text-sky-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  auto
                </span>
              )}
            </div>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleSyncAll}
                  disabled={syncingAll || enabledSourceCount === 0}
                  className="gap-2"
                  aria-label={
                    enabledSourceCount === 0
                      ? 'Add a source with a URL first'
                      : `Scan ${enabledSourceCount} source${enabledSourceCount !== 1 ? 's' : ''}`
                  }
                >
                  {syncingAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Radio className="h-4 w-4" />
                  )}
                  {syncingAll ? (autoSyncing ? 'Auto-scanning...' : 'Scanning...') : 'Scan Sources'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {enabledSourceCount === 0
                  ? 'Add a source with a URL first'
                  : `Scan ${enabledSourceCount} active source${enabledSourceCount !== 1 ? 's' : ''} for new jobs`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Sync Feedback */}
      {syncFeedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm ${
            syncFeedback.type === 'success'
              ? 'border-emerald-300 bg-white text-emerald-700'
              : 'border-amber-300 bg-white text-amber-700'
          }`}
        >
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1 break-words font-medium">{syncFeedback.message}</span>
          <button
            onClick={() => setSyncFeedback(null)}
            className="focus-visible:ring-ring shrink-0 rounded-md p-1 transition-colors hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Sources Panel (collapsible) */}
      <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <button
          type="button"
          onClick={() => setShowSources((v) => !v)}
          aria-expanded={showSources}
          className="hover:bg-accent/40 focus-visible:ring-ring flex w-full items-center justify-between px-5 py-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <div className="flex items-center gap-2.5">
            <Radio className="text-primary h-4 w-4" />
            <span className="font-semibold">Job Sources</span>
            <Badge variant="secondary" className="text-[10px] font-medium">
              {sources.length} source{sources.length !== 1 ? 's' : ''}
            </Badge>
            {enabledSourceCount > 0 && (
              <Badge variant="default" className="text-[10px] font-medium">
                {enabledSourceCount} active
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`text-muted-foreground h-4 w-4 transition-transform duration-200 ${showSources ? 'rotate-180' : ''}`}
          />
        </button>

        {showSources && (
          <div className="space-y-3 border-t px-5 pb-5">
            {sources.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Radio className="text-muted-foreground/40 mb-2 h-8 w-8" />
                <p className="text-foreground text-sm font-medium">No sources configured</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Add a job board or careers page to scan for opportunities automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-3">
                {sources.map((source) => {
                  const hasUrl = !!(source.config as any)?.url;
                  const isSyncing = syncingIds.has(source.id);
                  return (
                    <div
                      key={source.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-colors ${
                        source.enabled ? 'bg-card hover:bg-accent/20' : 'bg-muted/30 opacity-75'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={source.enabled}
                          aria-label={`${source.enabled ? 'Disable' : 'Enable'} ${source.name}`}
                          onClick={() => handleToggleSource(source.id, !source.enabled)}
                          className={`focus-visible:ring-ring flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                            source.enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                        >
                          <span
                            className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              source.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{source.name}</span>
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px] font-medium uppercase"
                            >
                              {source.type}
                            </Badge>
                            {(source.config as any)?.searchTerm && (
                              <Badge
                                variant="outline"
                                className="shrink-0 border-sky-300 bg-white text-[10px] font-medium text-sky-700"
                              >
                                <Search className="mr-0.5 h-2.5 w-2.5" />
                                search
                              </Badge>
                            )}
                          </div>
                          {hasUrl && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 break-all text-xs">
                              {(source.config as any).url}
                            </p>
                          )}
                          {(source.config as any)?.searchTerm && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                              {(source.config as any).searchTerm}
                              {(source.config as any).location
                                ? ` in ${(source.config as any).location}`
                                : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {source.lastSyncAt && (
                          <span
                            className="text-muted-foreground mr-1 text-[10px] tabular-nums"
                            title={new Date(source.lastSyncAt).toLocaleString()}
                          >
                            {timeAgo(source.lastSyncAt)}
                          </span>
                        )}
                        {(hasUrl || (source.config as any)?.searchTerm) && source.enabled && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-primary h-7 w-7"
                            onClick={() => handleSyncOne(source.id)}
                            disabled={isSyncing || syncingAll}
                            aria-label={`Sync ${source.name}`}
                          >
                            {isSyncing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-7 w-7"
                          onClick={() => handleDeleteSource(source.id)}
                          aria-label={`Remove ${source.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-1 gap-2"
              onClick={() => setShowAddSource(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Source
            </Button>
          </div>
        )}
      </div>

      {/* Add Source Dialog */}
      <AddSourceDialog
        open={showAddSource}
        onOpenChange={setShowAddSource}
        onCreated={(source) => {
          setSources((prev) => [...prev, source]);
          setShowAddSource(false);
        }}
      />

      {/* Add Job Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Job</DialogTitle>
            <DialogDescription>
              Paste a URL, job description text, or add details manually.
            </DialogDescription>
          </DialogHeader>
          <AddJobByUrl
            onClose={() => setShowAddForm(false)}
            onCreated={() => {
              setShowAddForm(false);
              router.invalidate();
            }}
          />
          <Separator />
          <AddJobByText
            onClose={() => setShowAddForm(false)}
            onCreated={() => {
              setShowAddForm(false);
              router.invalidate();
            }}
          />
          <Separator />
          <AddJobForm
            onClose={() => setShowAddForm(false)}
            onCreated={() => {
              setShowAddForm(false);
              router.invalidate();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Search jobs by title, company, location, or skills..."
              className="pl-10"
              value={localQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              aria-label="Search jobs"
            />
            {localQuery && (
              <button
                type="button"
                onClick={() => handleQueryChange('')}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-2"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            className="relative gap-2"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {/* Quick preset dropdown */}
          {presets.length > 0 && (
            <div className="group relative">
              <Button variant="outline" className="gap-2">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">Presets</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <div className="bg-card absolute right-0 top-full z-50 mt-1 hidden min-w-[200px] rounded-lg border p-1 shadow-lg hover:block group-focus-within:block">
                {presets.map((preset: any) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="hover:bg-accent/50 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors"
                    onClick={() => handleLoadPreset(preset)}
                  >
                    <span className="truncate font-medium">{preset.key}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile skill chips for quick search */}
        {profileSkills.length > 0 && !localQuery && (
          <div
            className="flex flex-wrap items-center gap-2"
            role="list"
            aria-label="Quick filter by skill"
          >
            <span className="text-foreground/70 shrink-0 text-xs font-medium">My skills:</span>
            {profileSkills.slice(0, 8).map((skill: any) => (
              <button
                key={skill.id}
                type="button"
                role="listitem"
                className="border-border text-foreground focus-visible:ring-ring inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-sky-300 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2"
                onClick={() => handleQueryChange(skill.name)}
              >
                <Search className="mr-1 h-2.5 w-2.5 opacity-50" />
                {skill.name}
              </button>
            ))}
            {profileSkills.length > 8 && (
              <span className="text-muted-foreground text-xs font-medium">
                +{profileSkills.length - 8} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Filter Jobs</DialogTitle>
            <DialogDescription>
              Narrow down your flight plan by specific criteria.
            </DialogDescription>
          </DialogHeader>

          {/* Saved Presets */}
          {presets.length > 0 && (
            <div className="space-y-2">
              <span className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Saved Presets
              </span>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset: any) => (
                  <div
                    key={preset.id}
                    className="inline-flex items-center gap-1 rounded-full border bg-white px-3 py-1"
                  >
                    <button
                      type="button"
                      className="hover:text-primary text-xs font-medium transition-colors"
                      onClick={() => {
                        handleLoadPreset(preset);
                        setShowFilters(false);
                      }}
                    >
                      {preset.key}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => handleDeletePreset(preset.id)}
                      aria-label={`Delete preset ${preset.key}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Separator />
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Remote Policy */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Remote Policy
              </legend>
              <div className="space-y-2.5">
                {['remote', 'hybrid', 'onsite'].map((policy) => {
                  const currentRemote = search.remote?.split(',').filter(Boolean) ?? [];
                  const isChecked = currentRemote.includes(policy);
                  return (
                    <label
                      key={policy}
                      className="group flex cursor-pointer items-center gap-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="border-input text-primary focus:ring-primary h-4 w-4 rounded focus:ring-offset-0"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...currentRemote, policy]
                            : currentRemote.filter((p) => p !== policy);
                          updateSearch({ remote: next.length > 0 ? next.join(',') : undefined });
                        }}
                      />
                      <span className="group-hover:text-foreground transition-colors">
                        {policy.charAt(0).toUpperCase() + policy.slice(1)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Score Range */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Minimum Score
              </legend>
              <div className="space-y-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={search.minScore ?? 0}
                  onChange={(e) => updateSearch({ minScore: Number(e.target.value) || undefined })}
                  className="accent-primary w-full"
                  aria-label="Minimum score"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">0</span>
                  <span className="text-foreground bg-primary/10 rounded px-2 py-0.5 font-semibold tabular-nums">
                    {search.minScore ?? 0}
                  </span>
                  <span className="text-muted-foreground">100</span>
                </div>
              </div>
            </fieldset>

            {/* Recommendation */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Recommendation
              </legend>
              <div className="space-y-2.5">
                {[
                  { key: 'strong_apply', label: 'Strong Apply' },
                  { key: 'apply', label: 'Apply' },
                  { key: 'maybe', label: 'Maybe' },
                  { key: 'skip', label: 'Skip' },
                ].map(({ key, label }) => {
                  const currentRecs = search.recommendation?.split(',').filter(Boolean) ?? [];
                  const isChecked = currentRecs.includes(key);
                  return (
                    <label
                      key={key}
                      className="group flex cursor-pointer items-center gap-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="border-input text-primary focus:ring-primary h-4 w-4 rounded focus:ring-offset-0"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...currentRecs, key]
                            : currentRecs.filter((r) => r !== key);
                          updateSearch({
                            recommendation: next.length > 0 ? next.join(',') : undefined,
                          });
                        }}
                      />
                      <span className="group-hover:text-foreground transition-colors">{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Has Score */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Score Status
              </legend>
              <div className="space-y-2.5">
                {[
                  { key: undefined as any, label: 'All Jobs' },
                  { key: 'scored' as const, label: 'Scored Only' },
                  { key: 'unscored' as const, label: 'Unscored Only' },
                ].map(({ key, label }) => (
                  <label
                    key={label}
                    className="group flex cursor-pointer items-center gap-2.5 text-sm"
                  >
                    <input
                      type="radio"
                      name="has-score-filter"
                      className="border-input text-primary focus:ring-primary h-4 w-4 focus:ring-offset-0"
                      checked={search.hasScore === key}
                      onChange={() => updateSearch({ hasScore: key })}
                    />
                    <span className="group-hover:text-foreground transition-colors">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Employment Type */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Employment Type
              </legend>
              <div className="space-y-2.5">
                {[
                  { key: 'full_time', label: 'Full-time' },
                  { key: 'part_time', label: 'Part-time' },
                  { key: 'contract', label: 'Contract' },
                  { key: 'internship', label: 'Internship' },
                ].map(({ key, label }) => {
                  const currentTypes = search.employmentType?.split(',').filter(Boolean) ?? [];
                  const isChecked = currentTypes.includes(key);
                  return (
                    <label
                      key={key}
                      className="group flex cursor-pointer items-center gap-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="border-input text-primary focus:ring-primary h-4 w-4 rounded focus:ring-offset-0"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...currentTypes, key]
                            : currentTypes.filter((t) => t !== key);
                          updateSearch({
                            employmentType: next.length > 0 ? next.join(',') : undefined,
                          });
                        }}
                      />
                      <span className="group-hover:text-foreground transition-colors">{label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Compensation Range */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Compensation
                </span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 100000"
                    value={search.minComp ?? ''}
                    onChange={(e) =>
                      updateSearch({ minComp: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 200000"
                    value={search.maxComp ?? ''}
                    onChange={(e) =>
                      updateSearch({ maxComp: e.target.value ? Number(e.target.value) : undefined })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </fieldset>

            {/* Domain */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Domain
              </legend>
              <Input
                placeholder="e.g. fintech, healthcare"
                value={search.domain ?? ''}
                onChange={(e) => updateSearch({ domain: e.target.value || undefined })}
                className="h-8 text-sm"
              />
            </fieldset>

            {/* Sponsorship */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Sponsorship
              </legend>
              <select
                className="border-input focus-visible:ring-ring flex h-8 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                value={search.sponsorship ?? ''}
                onChange={(e) => updateSearch({ sponsorship: e.target.value || undefined })}
              >
                <option value="">Any</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="unknown">Unknown</option>
              </select>
            </fieldset>

            {/* Years Required */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                Years Required
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={search.minYears ?? ''}
                    onChange={(e) =>
                      updateSearch({
                        minYears: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    placeholder="10+"
                    value={search.maxYears ?? ''}
                    onChange={(e) =>
                      updateSearch({
                        maxYears: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </fieldset>

            {/* Posted After */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Posted After
                </span>
              </legend>
              <Input
                type="date"
                value={search.postedAfter ?? ''}
                onChange={(e) => updateSearch({ postedAfter: e.target.value || undefined })}
                className="h-8 text-sm"
              />
            </fieldset>

            {/* Sort */}
            <fieldset className="space-y-3">
              <legend className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5" /> Sort By
                </span>
              </legend>
              <div className="flex gap-2">
                <select
                  className="border-input focus-visible:ring-ring flex h-8 flex-1 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                  value={search.sortBy ?? 'score'}
                  onChange={(e) => updateSearch({ sortBy: (e.target.value as any) || undefined })}
                >
                  <option value="score">Score</option>
                  <option value="date">Date</option>
                  <option value="company">Company</option>
                  <option value="title">Title</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() =>
                    updateSearch({ sortDir: search.sortDir === 'asc' ? 'desc' : 'asc' })
                  }
                  aria-label="Toggle sort direction"
                >
                  {search.sortDir === 'asc' ? 'ASC' : 'DESC'}
                </Button>
              </div>
            </fieldset>
          </div>

          <Separator />

          {/* Save Preset */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Preset name..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="h-8 flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSavePreset();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              onClick={handleSavePreset}
              disabled={!presetName.trim() || savingPreset}
            >
              <Save className="h-3.5 w-3.5" />
              {savingPreset ? 'Saving...' : 'Save Current'}
            </Button>
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground text-sm"
              onClick={() => {
                navigate({ search: {} });
              }}
            >
              Clear all filters
            </Button>
            <Button onClick={() => setShowFilters(false)} className="px-6">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Count */}
      {totalItems > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing{' '}
            <span className="text-foreground font-medium">{(currentPage - 1) * pageSize + 1}</span>-
            <span className="text-foreground font-medium">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{' '}
            of <span className="text-foreground font-medium">{totalItems}</span> job
            {totalItems !== 1 ? 's' : ''}
          </p>
          {search.q && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleQueryChange('')}
            >
              <X className="h-3 w-3" />
              Clear search
            </Button>
          )}
        </div>
      )}

      {/* Job Cards or Empty State */}
      {visibleJobs.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center rounded-xl border px-6 py-16 shadow-sm">
          <div className="from-primary/10 mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br to-sky-100">
            <Plane className="text-primary/60 h-12 w-12" />
          </div>
          <h3 className="text-foreground mb-2 text-xl font-bold">
            {search.q || activeFilterCount > 0 ? 'No matching jobs' : 'No jobs on radar yet'}
          </h3>
          <p className="text-muted-foreground mb-8 max-w-md text-center text-sm leading-relaxed">
            {search.q || activeFilterCount > 0
              ? 'No jobs match your current search or filters. Try adjusting your criteria.'
              : 'Your flight plan is clear. Add a job source and scan for opportunities, or paste a job posting URL to get started.'}
          </p>
          {search.q || activeFilterCount > 0 ? (
            <Button
              onClick={() => {
                handleQueryChange('');
                navigate({ search: {} });
              }}
              variant="outline"
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button
                onClick={() => {
                  setShowSources(true);
                  setShowAddSource(true);
                }}
                variant="outline"
                className="gap-2"
              >
                <Radio className="h-4 w-4" />
                Add a Source
              </Button>
              <Button onClick={() => setShowAddForm(true)} className="gap-2">
                <LinkIcon className="h-4 w-4" />
                Add Job by URL
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleJobs.map((job: any) => (
            <JobCard
              key={job.id}
              job={job}
              matchInfo={jobMatchMap.get(job.id)}
              onRequestDelete={(id) => setDeletingId(id)}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pb-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSearch({ page: Math.max(1, currentPage - 1) })}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((pg) => {
                    if (pg === 1 || pg === totalPages) return true;
                    if (Math.abs(pg - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce((acc, pg, idx, arr) => {
                    if (idx > 0 && pg - arr[idx - 1] > 1) {
                      acc.push(
                        <span key={`ellipsis-${pg}`} className="text-muted-foreground px-1 text-sm">
                          ...
                        </span>,
                      );
                    }
                    acc.push(
                      <Button
                        key={pg}
                        variant={pg === currentPage ? 'default' : 'outline'}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => updateSearch({ page: pg })}
                      >
                        {pg}
                      </Button>,
                    );
                    return acc;
                  }, [] as React.ReactNode[])}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSearch({ page: Math.min(totalPages, currentPage + 1) })}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Card
// ---------------------------------------------------------------------------

function JobCard({
  job,
  matchInfo,
  onRequestDelete,
}: {
  job: Job;
  matchInfo?: { matched: string[]; missing: string[]; matchPct: number };
  onRequestDelete: (id: string) => void;
}) {
  const comp = formatCompensation(
    job.compensationMin,
    job.compensationMax,
    job.compensationCurrency,
    job.compensationType ?? 'annual',
  );

  const skills = job.mustHaveSkills ?? [];
  const matchedSet = React.useMemo(
    () => new Set(matchInfo?.matched.map((s) => s.toLowerCase()) ?? []),
    [matchInfo],
  );
  const visibleSkills = skills.slice(0, 4);
  const extraCount = skills.length - 4;

  const hasScore = job.score && job.score.overallScore != null;

  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="bg-card hover:border-primary/30 focus-visible:ring-ring group block rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: Main info */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Title & Company */}
            <div>
              <h3 className="text-foreground group-hover:text-primary text-base font-semibold leading-tight transition-colors">
                {job.title}
              </h3>
              <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-sm">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{job.company}</span>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {job.location && (
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {job.location}
                </span>
              )}
              {job.remotePolicy && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRemotePolicyColor(job.remotePolicy)}`}
                >
                  <Globe className="h-3 w-3" />
                  {job.remotePolicy.charAt(0).toUpperCase() + job.remotePolicy.slice(1)}
                </span>
              )}
              {comp && (
                <span className="text-foreground/80 inline-flex items-center gap-1 font-medium">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  {comp}
                </span>
              )}
              {job.employmentType && (
                <Badge variant="secondary" className="text-xs font-medium">
                  <Briefcase className="mr-1 h-3 w-3" />
                  {job.employmentType.charAt(0).toUpperCase() + job.employmentType.slice(1)}
                </Badge>
              )}
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
                <Clock className="h-3 w-3 shrink-0" />
                {timeAgo(job.createdAt)}
              </span>
            </div>

            {/* Skills -- matched skills highlighted */}
            {visibleSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {visibleSkills.map((skill) => {
                  const isMatched = matchedSet.has(skill.toLowerCase());
                  return (
                    <Badge
                      key={skill}
                      variant="outline"
                      className={`text-xs font-normal ${
                        isMatched
                          ? 'border-emerald-300 bg-white text-emerald-700'
                          : 'border-border text-muted-foreground bg-white'
                      }`}
                    >
                      {isMatched && <CheckCircle2 className="mr-0.5 h-3 w-3 shrink-0" />}
                      {skill}
                    </Badge>
                  );
                })}
                {extraCount > 0 && (
                  <Badge
                    variant="outline"
                    className="border-border text-muted-foreground bg-white text-xs font-normal"
                  >
                    +{extraCount} more
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Right: Score + Actions */}
          <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end">
            {hasScore && (
              <div
                className={`flex flex-col items-center rounded-lg border px-4 py-2.5 ${getScoreBg(job.score!.overallScore!)}`}
              >
                <span
                  className={`text-2xl font-bold tabular-nums leading-none ${getScoreColor(job.score!.overallScore!)}`}
                >
                  {job.score!.overallScore}
                </span>
                <span
                  className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${getScoreColor(job.score!.overallScore!)}`}
                >
                  {getScoreLabel(job.score!.overallScore!)}
                </span>
                {job.score!.recommendation && (
                  <Badge
                    variant={getRecommendationVariant(job.score!.recommendation)}
                    className="mt-1.5 px-2 text-[10px]"
                  >
                    {getRecommendationLabel(job.score!.recommendation)}
                  </Badge>
                )}
                {matchInfo && matchInfo.matchPct > 0 && (
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      matchInfo.matchPct >= 75
                        ? 'text-emerald-700'
                        : matchInfo.matchPct >= 50
                          ? 'text-sky-700'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {matchInfo.matchPct}% skill match
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
              {job.applyUrl && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="hidden sm:inline">View Posting</span>
                    <span className="sm:hidden">View</span>
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive focus-visible:ring-destructive h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRequestDelete(job.id);
                }}
                aria-label={`Delete ${job.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Add Source Dialog
// ---------------------------------------------------------------------------

function AddSourceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (source: any) => void;
}) {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('custom');
  const [url, setUrl] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchLocation, setSearchLocation] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const selectedPreset = SOURCE_PRESETS.find((p) => p.type === type);
  const supportsSearch = selectedPreset?.supportsSearch ?? false;

  const handlePreset = (preset: (typeof SOURCE_PRESETS)[number]) => {
    setName(preset.name);
    setType(preset.type);
  };

  const canSubmit = name.trim() && (url.trim() || searchTerm.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const source = await api.settings.addJobSource({
        name: name.trim(),
        type,
        url: url.trim() || undefined,
        searchTerm: searchTerm.trim() || undefined,
        location: searchLocation.trim() || undefined,
      });
      onCreated(source);
      setName('');
      setType('custom');
      setUrl('');
      setSearchTerm('');
      setSearchLocation('');
    } catch (err) {
      console.error('Failed to add source:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Job Source</DialogTitle>
          <DialogDescription>
            Add a job board, careers page, or search query to scan for opportunities.
          </DialogDescription>
        </DialogHeader>

        {/* Quick Presets */}
        <div className="space-y-2.5">
          <Label className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Quick Add
          </Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Source type presets">
            {SOURCE_PRESETS.map((preset) => (
              <Button
                key={preset.type}
                variant={type === preset.type && name === preset.name ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => handlePreset(preset)}
                aria-pressed={type === preset.type && name === preset.name}
              >
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="source-name">Source Name</Label>
              <Input
                id="source-name"
                placeholder="e.g. LinkedIn Software"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source-type">Type</Label>
              <select
                id="source-type"
                className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {SOURCE_PRESETS.map((p) => (
                  <option key={p.type} value={p.type}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search-based config for LinkedIn, Indeed, Adzuna */}
          {supportsSearch && (
            <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-sky-600" />
                <span className="text-sm font-medium text-sky-900">Search Query</span>
                <Badge
                  variant="outline"
                  className="border-sky-300 bg-white text-[10px] text-sky-700"
                >
                  {type === 'serpapi' ? 'SerpAPI' : type === 'adzuna' ? 'Adzuna API' : 'ts-jobspy'}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="source-search" className="text-xs">
                    Search Term
                  </Label>
                  <Input
                    id="source-search"
                    placeholder="e.g. software engineer"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="source-location" className="text-xs">
                    Location
                  </Label>
                  <Input
                    id="source-location"
                    placeholder="e.g. San Francisco, CA"
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-sky-700/70">
                {type === 'serpapi'
                  ? "Uses the SerpAPI Google Jobs API to search Google's job listings. Requires a SerpAPI key in Settings."
                  : type === 'adzuna'
                    ? 'Uses the Adzuna API to search structured job data. Requires an Adzuna API key in Settings.'
                    : `Scrapes ${type === 'linkedin' ? 'LinkedIn' : 'Indeed'} directly for matching jobs. Works best with specific search terms.`}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="source-url">
              URL {supportsSearch ? '(optional if using search)' : ''}
            </Label>
            <Input
              id="source-url"
              type="url"
              placeholder="https://www.usajobs.gov/search/results?k=software+engineer"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Paste a search results URL or specific job listing URL. The scanner will fetch and
              parse jobs from this page.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? 'Adding...' : 'Add Source'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Add Job by URL
// ---------------------------------------------------------------------------

function AddJobByUrl({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const result = await api.ai.ingestJobFromUrl({ url: url.trim() });
      if ((result as any).deduplicated) {
        captureEvent('job_added_by_url', { company: result.company, deduplicated: true });
        setFeedback({
          type: 'success',
          message: `Already on radar: ${result.title} at ${result.company}.`,
        });
      } else {
        captureEvent('job_added_by_url', { company: result.company, title: result.title });
        setFeedback({
          type: 'success',
          message: `Added ${result.title} at ${result.company}.`,
        });
      }
      setTimeout(() => {
        onCreated();
      }, 1500);
    } catch (err) {
      captureEvent('job_add_failed', { method: 'url' });
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse job from URL.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleFetch} className="space-y-4">
      <div className="flex items-center gap-2">
        <LinkIcon className="text-muted-foreground h-4 w-4" />
        <h3 className="text-sm font-semibold">Add by URL</h3>
      </div>

      <p className="text-muted-foreground text-sm">
        Paste a job posting URL and we will auto-parse the listing and score it against your
        profile.
      </p>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Input
            type="url"
            placeholder="https://boards.greenhouse.io/company/jobs/12345"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <Button type="submit" disabled={!url.trim() || loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Plane className="h-4 w-4" />
              Fetch &amp; Parse
            </>
          )}
        </Button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-300 bg-white text-emerald-700'
              : 'border-red-300 bg-white text-red-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="break-words font-medium">{feedback.message}</span>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Add Job by Text
// ---------------------------------------------------------------------------

function AddJobByText({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [text, setText] = React.useState('');
  const [sourceLabel, setSourceLabel] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const result = await api.ai.ingestJobFromText({
        text: text.trim(),
        sourceLabel: sourceLabel.trim() || undefined,
      });
      if ((result as any).deduplicated) {
        captureEvent('job_added_by_text', { company: result.company, deduplicated: true });
        setFeedback({
          type: 'success',
          message: `Already on radar: ${result.title} at ${result.company}.`,
        });
      } else {
        captureEvent('job_added_by_text', { company: result.company, title: result.title });
        setFeedback({
          type: 'success',
          message: `Added ${result.title} at ${result.company}.`,
        });
      }
      setTimeout(() => {
        onCreated();
      }, 1500);
    } catch (err) {
      captureEvent('job_add_failed', { method: 'text' });
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse job from text.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="text-muted-foreground h-4 w-4" />
        <h3 className="text-sm font-semibold">Paste Job Description</h3>
      </div>

      <p className="text-muted-foreground text-sm">
        Copy and paste a full job description. AI will extract the title, company, skills, and other
        details automatically.
      </p>

      <div className="space-y-2">
        <Label htmlFor="paste-source-label">Source Label (optional)</Label>
        <Input
          id="paste-source-label"
          placeholder="e.g. LinkedIn, email from recruiter"
          value={sourceLabel}
          onChange={(e) => setSourceLabel(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paste-text">Job Description *</Label>
        <textarea
          id="paste-text"
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[160px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Paste the full job description here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          required
        />
        <p className="text-muted-foreground text-xs">
          Include title, company, requirements, and any other details from the posting.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!text.trim() || loading} className="gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <Plane className="h-4 w-4" />
              Parse &amp; Add
            </>
          )}
        </Button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-300 bg-white text-emerald-700'
              : 'border-red-300 bg-white text-red-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="break-words font-medium">{feedback.message}</span>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Add Job Form
// ---------------------------------------------------------------------------

function AddJobForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [submitting, setSubmitting] = React.useState(false);
  const [showOptional, setShowOptional] = React.useState(false);

  // Required fields
  const [company, setCompany] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [applyUrl, setApplyUrl] = React.useState('');
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [rawDescription, setRawDescription] = React.useState('');

  // Optional fields
  const [location, setLocation] = React.useState('');
  const [remotePolicy, setRemotePolicy] = React.useState('');
  const [compensationMin, setCompensationMin] = React.useState('');
  const [compensationMax, setCompensationMax] = React.useState('');
  const [compensationCurrency, setCompensationCurrency] = React.useState('USD');
  const [compensationType, setCompensationType] = React.useState('annual');
  const [employmentType, setEmploymentType] = React.useState('');
  const [yearsRequired, setYearsRequired] = React.useState('');
  const [mustHaveSkills, setMustHaveSkills] = React.useState('');
  const [niceToHaveSkills, setNiceToHaveSkills] = React.useState('');

  const canSubmit =
    company.trim() && title.trim() && applyUrl.trim() && sourceUrl.trim() && rawDescription.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      await api.jobs.create({
        company: company.trim(),
        title: title.trim(),
        location: location.trim() || '',
        applyUrl: applyUrl.trim(),
        sourceUrl: sourceUrl.trim(),
        rawDescription: rawDescription.trim(),
        ...(remotePolicy ? { remotePolicy } : {}),
        ...(compensationMin ? { compensationMin: Number(compensationMin) } : {}),
        ...(compensationMax ? { compensationMax: Number(compensationMax) } : {}),
        ...(compensationCurrency !== 'USD' ? { compensationCurrency } : {}),
        ...(compensationType !== 'annual' ? { compensationType } : {}),
        ...(employmentType ? { employmentType } : {}),
        ...(yearsRequired ? { yearsRequired: Number(yearsRequired) } : {}),
        ...(mustHaveSkills.trim()
          ? {
              mustHaveSkills: mustHaveSkills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(niceToHaveSkills.trim()
          ? {
              niceToHaveSkills: niceToHaveSkills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
      });
      onCreated();
    } catch (err) {
      console.error('Failed to create job:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2">
        <Plus className="text-muted-foreground h-4 w-4" />
        <h3 className="text-sm font-semibold">Or Add Manually</h3>
      </div>

      {/* Required Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="add-company">Company *</Label>
          <Input
            id="add-company"
            placeholder="e.g. Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-title">Job Title *</Label>
          <Input
            id="add-title"
            placeholder="e.g. Senior Software Engineer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-apply-url">Apply URL *</Label>
          <Input
            id="add-apply-url"
            type="url"
            placeholder="https://..."
            value={applyUrl}
            onChange={(e) => setApplyUrl(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-source-url">Source URL *</Label>
          <Input
            id="add-source-url"
            type="url"
            placeholder="https://..."
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="add-description">Raw Description *</Label>
        <textarea
          id="add-description"
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Paste the full job description here..."
          value={rawDescription}
          onChange={(e) => setRawDescription(e.target.value)}
          required
        />
      </div>

      {/* Optional Fields Toggle */}
      <button
        type="button"
        aria-expanded={showOptional}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-1 flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
        onClick={() => setShowOptional((v) => !v)}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${showOptional ? 'rotate-180' : ''}`}
        />
        {showOptional ? 'Hide' : 'Show'} optional fields
      </button>

      {showOptional && (
        <>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="add-location">Location</Label>
              <Input
                id="add-location"
                placeholder="e.g. San Francisco, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-remote-policy">Remote Policy</Label>
              <select
                id="add-remote-policy"
                className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                value={remotePolicy}
                onChange={(e) => setRemotePolicy(e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-employment-type">Employment Type</Label>
              <select
                id="add-employment-type"
                className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-comp-min">Compensation Min</Label>
              <Input
                id="add-comp-min"
                type="number"
                placeholder="e.g. 120000"
                value={compensationMin}
                onChange={(e) => setCompensationMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-comp-max">Compensation Max</Label>
              <Input
                id="add-comp-max"
                type="number"
                placeholder="e.g. 180000"
                value={compensationMax}
                onChange={(e) => setCompensationMax(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-comp-currency">Currency</Label>
              <Input
                id="add-comp-currency"
                placeholder="USD"
                value={compensationCurrency}
                onChange={(e) => setCompensationCurrency(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-comp-type">Compensation Type</Label>
              <select
                id="add-comp-type"
                className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                value={compensationType}
                onChange={(e) => setCompensationType(e.target.value)}
              >
                <option value="annual">Annual</option>
                <option value="hourly">Hourly</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-years">Years Required</Label>
              <Input
                id="add-years"
                type="number"
                placeholder="e.g. 3"
                value={yearsRequired}
                onChange={(e) => setYearsRequired(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-must-have">Must-have Skills (comma-separated)</Label>
              <Input
                id="add-must-have"
                placeholder="e.g. React, TypeScript, Node.js"
                value={mustHaveSkills}
                onChange={(e) => setMustHaveSkills(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-nice-to-have">Nice-to-have Skills (comma-separated)</Label>
              <Input
                id="add-nice-to-have"
                placeholder="e.g. AWS, GraphQL, Docker"
                value={niceToHaveSkills}
                onChange={(e) => setNiceToHaveSkills(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Adding...' : 'Add Job'}
        </Button>
      </div>
    </form>
  );
}
