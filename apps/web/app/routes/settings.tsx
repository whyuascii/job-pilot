import React from 'react';
import { createFileRoute, useRouter, Link } from '@tanstack/react-router';
import { Key, Globe, Database, Mail, Plus, Trash2, Check, X, RefreshCw, Loader2, Clock, AlertCircle, CheckCircle2, Unplug, Search, ExternalLink, Sparkles, ChevronDown, User, Eye, EyeOff, Lock } from 'lucide-react';
import {
  Button,
  Badge,
  Separator,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@job-pilot/ui';
import { api } from '~/lib/api-client';
import { authClient } from '~/lib/auth-client';

interface SyncResult {
  sourceId: string;
  sourceName: string;
  jobsFound: number;
  newJobs: number;
  duplicates: number;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/settings')({
  loader: async () => {
    const [apiKeys, sources, gmailStatus, session] = await Promise.all([
      api.settings.getApiKeyStatus(),
      api.settings.listJobSources(),
      api.gmail.getStatus().catch(() => ({ connected: false } as { connected: boolean; scope?: string; connectedAt?: string })),
      api.auth.getSession().catch(() => null),
    ]);
    return { apiKeys, sources, gmailStatus, session };
  },
  component: SettingsPage,
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function SettingsPage() {
  const { apiKeys, sources, gmailStatus, session } = Route.useLoaderData();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ground Control</h1>
        <p className="text-muted-foreground">
          Configure your Job Pilot system settings.
        </p>
      </div>

      <div className="grid gap-6">
        <AccountSettingsSection session={session} />
        <ApiKeysSection apiKeys={apiKeys} />
        <GmailSection gmailStatus={gmailStatus} onMutate={() => router.invalidate()} />
        <JobSourcesSection sources={sources} onMutate={() => router.invalidate()} />
        <DataManagementSection />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Keys Section
// ---------------------------------------------------------------------------

type ApiKeyStatus = Awaited<ReturnType<typeof api.settings.getApiKeyStatus>>;

function ApiKeysSection({ apiKeys }: { apiKeys: ApiKeyStatus }) {
  const router = useRouter();

  return (
    <SettingsSection
      icon={<Key className="h-5 w-5" />}
      title="API Keys"
      description="Manage your service credentials. Keys are encrypted and stored securely."
    >
      <div className="space-y-4">
        <EditableApiKeyRow
          label="Anthropic (Claude)"
          service="anthropic"
          configured={apiKeys.anthropic.hasKey}
          masked={apiKeys.anthropic.maskedKey}
          placeholder="sk-ant-..."
          onMutate={() => router.invalidate()}
        />
        <Separator />
        <EditableApiKeyRow
          label="Firecrawl"
          service="firecrawl"
          configured={apiKeys.firecrawl.hasKey}
          masked={apiKeys.firecrawl.maskedKey}
          placeholder="fc-..."
          onMutate={() => router.invalidate()}
        />
        <Separator />
        <EditableApiKeyRow
          label="Adzuna (Job Search API)"
          service="adzuna"
          configured={apiKeys.adzuna?.hasKey ?? false}
          masked={apiKeys.adzuna?.maskedKey ?? null}
          placeholder="appId:appKey"
          onMutate={() => router.invalidate()}
        />
        <Separator />
        <EditableApiKeyRow
          label="SerpAPI (Google Jobs)"
          service="serpapi"
          configured={apiKeys.serpapi?.hasKey ?? false}
          masked={apiKeys.serpapi?.maskedKey ?? null}
          placeholder="your-serpapi-key"
          onMutate={() => router.invalidate()}
        />
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {apiKeys.s3.configured ? (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/15">
                <Check className="h-3.5 w-3.5 text-green-600" />
              </div>
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15">
                <X className="h-3.5 w-3.5 text-red-500" />
              </div>
            )}
            <span className="text-sm font-medium">Object Storage (S3)</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {apiKeys.s3.configured ? apiKeys.s3.endpoint : 'Not configured'}
          </span>
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          Keys set here override environment variables. S3 storage is configured via <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env</code>.
        </div>
      </div>
    </SettingsSection>
  );
}

function EditableApiKeyRow({
  label,
  service,
  configured,
  masked,
  placeholder,
  onMutate,
}: {
  label: string;
  service: string;
  configured: boolean;
  masked: string | null;
  placeholder: string;
  onMutate: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.settings.saveApiKey({ service, apiKey: value.trim() });
      setValue('');
      setEditing(false);
      onMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await api.settings.deleteApiKey({ service });
      onMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete key');
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Key className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="font-mono text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setEditing(false); setValue(''); }
            }}
          />
          <Button size="sm" onClick={handleSave} disabled={saving || !value.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(''); setError(''); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {configured ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/15">
            <Check className="h-3.5 w-3.5 text-green-600" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15">
            <X className="h-3.5 w-3.5 text-red-500" />
          </div>
        )}
        <span className="text-sm font-medium">{label}</span>
        {configured && (
          <span className="font-mono text-xs text-muted-foreground">{masked}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setEditing(true)}
        >
          {configured ? 'Update' : 'Add Key'}
        </Button>
        {configured && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gmail Integration Section
// ---------------------------------------------------------------------------

type GmailStatus = Awaited<ReturnType<typeof api.gmail.getStatus>>;

function GmailSection({
  gmailStatus,
  onMutate,
}: {
  gmailStatus: GmailStatus;
  onMutate: () => void;
}) {
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{
    synced: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [error, setError] = React.useState('');

  async function handleConnect() {
    setConnecting(true);
    setError('');
    try {
      const { url } = await api.gmail.getAuthUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Gmail connection.');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setError('');
    try {
      await api.gmail.disconnect();
      onMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Gmail.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const result = await api.gmail.syncMessages();
      setSyncResult(result);
      onMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync messages.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SettingsSection
      icon={<Mail className="h-5 w-5" />}
      title="Gmail Integration"
      description="Connect your Gmail account to automatically detect recruiter messages."
    >
      <div className="space-y-4">
        {gmailStatus.connected ? (
          <>
            {/* Connected status */}
            <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/15">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Gmail Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {gmailStatus.connectedAt ? new Date(gmailStatus.connectedAt).toLocaleDateString() : 'recently'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  aria-label="Disconnect Gmail"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Sync result */}
            {syncResult && (
              <div className="rounded-md border border-emerald-300 bg-white p-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Found <strong>{syncResult.total}</strong> matching messages:
                    {' '}<strong>{syncResult.synced}</strong> new,
                    {' '}<strong>{syncResult.skipped}</strong> already imported.
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {/* What Gmail connection does */}
            <div className="rounded-lg border border-sky-300 bg-white p-4">
              <h4 className="text-sm font-semibold mb-2">What does connecting Gmail do?</h4>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>Automatically detects recruiter emails and interview invitations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>Updates application statuses when you receive responses</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>Read-only access — Job Pilot never sends emails on your behalf</span>
                </li>
              </ul>
            </div>

            {/* Connect button */}
            <div className="flex items-center justify-between rounded-md border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Not Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Click to securely connect via Google sign-in.
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mail className="mr-1.5 h-4 w-4" />
                    Connect Gmail
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="rounded-md border border-red-300 bg-white p-3 text-sm">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <p className="text-xs text-red-500/80 mt-1 ml-6">
              If this persists, check that your system administrator has configured the Gmail integration.
            </p>
          </div>
        )}

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          Your privacy is protected. Gmail data is only used to track application responses and is never shared.
        </div>
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Job Sources Section
// ---------------------------------------------------------------------------

type JobSource = Awaited<ReturnType<typeof api.settings.listJobSources>>[number];

/** Format a relative time string like "2 minutes ago" or "3 hours ago". */
function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

const SEARCH_SOURCES = [
  { type: 'linkedin', label: 'LinkedIn', description: 'Largest professional network' },
  { type: 'indeed', label: 'Indeed', description: 'Biggest job search engine' },
  { type: 'serpapi', label: 'Google Jobs', description: 'Google job aggregator', requiresKey: 'serpapi' },
  { type: 'adzuna', label: 'Adzuna', description: 'Jobs across 19 countries', requiresKey: 'adzuna' },
] as const;

// Each board has a searchUrl template: {q} = query, {l} = location
const JOB_BOARD_DIRECTORY = [
  { name: 'Glassdoor', searchUrl: 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword={q}&locT=C&locKeyword={l}', category: 'General', description: 'Company reviews and salary data' },
  { name: 'Wellfound', searchUrl: 'https://wellfound.com/role/r/{q}', category: 'Startups', description: 'Startup and tech jobs (ex-AngelList)' },
  { name: 'We Work Remotely', searchUrl: 'https://weworkremotely.com/remote-jobs/search?term={q}', category: 'Remote', description: 'Leading remote-only job board' },
  { name: 'RemoteOK', searchUrl: 'https://remoteok.com/remote-{q}-jobs', category: 'Remote', description: 'Remote jobs with salary transparency' },
  { name: 'Hacker News', searchUrl: 'https://news.ycombinator.com/jobs', category: 'Tech', description: 'YC startup job postings' },
  { name: 'Built In', searchUrl: 'https://builtin.com/jobs?search={q}&location={l}', category: 'Tech', description: 'Tech hub listings by city' },
  { name: 'Dice', searchUrl: 'https://www.dice.com/jobs?q={q}&location={l}', category: 'Tech', description: 'Technology-focused career site' },
  { name: 'Otta', searchUrl: 'https://otta.com/jobs?search={q}', category: 'Startups', description: 'Curated startup jobs with matching' },
  { name: 'Levels.fyi', searchUrl: 'https://www.levels.fyi/jobs?searchText={q}&location={l}', category: 'Tech', description: 'Verified compensation data' },
  { name: 'FlexJobs', searchUrl: 'https://www.flexjobs.com/search?search={q}&location={l}', category: 'Remote', description: 'Vetted remote and flexible jobs' },
  { name: 'Remote.co', searchUrl: 'https://remote.co/remote-jobs/search/?search_keywords={q}', category: 'Remote', description: 'Curated remote job listings' },
  { name: 'Working Nomads', searchUrl: 'https://www.workingnomads.com/jobs?category={q}', category: 'Remote', description: 'Remote jobs for digital nomads' },
  { name: 'The Muse', searchUrl: 'https://www.themuse.com/search?keyword={q}&location={l}', category: 'General', description: 'Company profiles and testimonials' },
  { name: 'USAJobs', searchUrl: 'https://www.usajobs.gov/Search/Results?k={q}&l={l}', category: 'Government', description: 'US federal government jobs' },
  { name: 'SimplyHired', searchUrl: 'https://www.simplyhired.com/search?q={q}&l={l}', category: 'General', description: 'Job aggregator with salary estimates' },
  { name: 'ZipRecruiter', searchUrl: 'https://www.ziprecruiter.com/jobs-search?search={q}&location={l}', category: 'General', description: 'AI-powered job matching' },
  { name: 'Stack Overflow', searchUrl: 'https://stackoverflow.com/jobs?q={q}&l={l}', category: 'Tech', description: 'Developer community jobs' },
  { name: 'Greenhouse', searchUrl: 'https://www.greenhouse.com/explore?query={q}', category: 'Tech', description: 'Companies using Greenhouse ATS' },
  { name: 'Lever Jobs', searchUrl: 'https://jobs.lever.co?search={q}', category: 'Tech', description: 'Companies using Lever ATS' },
] as const;

/** Build a search URL from a board template using the candidate's profile search config */
function buildBoardSearchUrl(template: string, searchConfig: any): string {
  const query = encodeURIComponent(searchConfig?.currentTitle || searchConfig?.searchTerms?.[0] || 'software engineer');
  const location = encodeURIComponent(searchConfig?.location || '');
  return template.replace(/\{q\}/g, query).replace(/\{l\}/g, location);
}

function JobSourcesSection({
  sources,
  onMutate,
}: {
  sources: JobSource[];
  onMutate: () => void;
}) {
  const [deletingSourceId, setDeletingSourceId] = React.useState<string | null>(null);

  // Search config state
  const [searchConfig, setSearchConfig] = React.useState<any>(null);
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [enablingType, setEnablingType] = React.useState<string | null>(null);

  // Job Board Directory state
  const [showDirectory, setShowDirectory] = React.useState(false);
  const [boardSearch, setBoardSearch] = React.useState('');
  const [addingBoard, setAddingBoard] = React.useState<string | null>(null);
  const [addedBoards, setAddedBoards] = React.useState<Set<string>>(() =>
    new Set(sources.map((s) => s.name)),
  );

  // Add Custom Source state
  const [showAddCustom, setShowAddCustom] = React.useState(false);
  const [customName, setCustomName] = React.useState('');
  const [customUrl, setCustomUrl] = React.useState('');
  const [customSubmitting, setCustomSubmitting] = React.useState(false);

  // Sync state
  const [syncingIds, setSyncingIds] = React.useState<Set<string>>(new Set());
  const [syncResults, setSyncResults] = React.useState<Record<string, SyncResult>>({});
  const [syncErrors, setSyncErrors] = React.useState<Record<string, string>>({});
  const [syncingAll, setSyncingAll] = React.useState(false);
  const [syncAllResult, setSyncAllResult] = React.useState<{
    results: SyncResult[];
    totalNewJobs: number;
    totalErrors: number;
  } | null>(null);

  // Load search config on mount
  React.useEffect(() => {
    api.settings.getSearchConfig()
      .then(setSearchConfig)
      .catch(() => setSearchConfig(null))
      .finally(() => setLoadingConfig(false));
  }, []);

  async function handleEnableSource(type: string) {
    setEnablingType(type);
    try {
      await api.settings.enableSource({ type });
      onMutate();
    } catch (err) {
      console.error('Failed to enable source:', err);
    } finally {
      setEnablingType(null);
    }
  }

  async function handleAddCustom() {
    if (!customName.trim()) return;
    setCustomSubmitting(true);
    try {
      await api.settings.addJobSource({
        name: customName.trim(),
        type: 'custom',
        url: customUrl.trim() || undefined,
      });
      setCustomName('');
      setCustomUrl('');
      setShowAddCustom(false);
      onMutate();
    } catch (err) {
      console.error('Failed to add custom source:', err);
    } finally {
      setCustomSubmitting(false);
    }
  }

  async function handleAddBoard(board: typeof JOB_BOARD_DIRECTORY[number]) {
    setAddingBoard(board.name);
    try {
      const url = buildBoardSearchUrl(board.searchUrl, searchConfig);
      await api.settings.addJobSource({
        name: board.name,
        type: 'url',
        url,
      });
      setAddedBoards((prev) => new Set(prev).add(board.name));
      onMutate();
    } catch (err) {
      console.error('Failed to add board:', err);
    } finally {
      setAddingBoard(null);
    }
  }

  async function handleDelete(sourceId: string) {
    try {
      await api.settings.deleteJobSource({ sourceId });
      onMutate();
    } catch (err) {
      console.error('Failed to delete job source:', err);
    }
  }

  async function handleToggle(sourceId: string, enabled: boolean) {
    try {
      await api.settings.toggleJobSource({ sourceId, enabled });
      onMutate();
    } catch (err) {
      console.error('Failed to toggle job source:', err);
    }
  }

  async function handleSyncSource(sourceId: string) {
    setSyncingIds((prev) => new Set([...prev, sourceId]));
    setSyncResults((prev) => { const next = { ...prev }; delete next[sourceId]; return next; });
    setSyncErrors((prev) => { const next = { ...prev }; delete next[sourceId]; return next; });

    try {
      const result = await api.settings.syncJobSource({ sourceId });
      setSyncResults((prev) => ({ ...prev, [sourceId]: result }));
      onMutate();
    } catch (err) {
      setSyncErrors((prev) => ({
        ...prev,
        [sourceId]: err instanceof Error ? err.message : 'Sync failed',
      }));
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    setSyncAllResult(null);
    setSyncResults({});
    setSyncErrors({});

    const enabledWithUrls = sources.filter(
      (s) => s.enabled && (s.config as any)?.url,
    );
    setSyncingIds(new Set(enabledWithUrls.map((s) => s.id)));

    try {
      const result = await api.settings.syncAllSources();
      setSyncAllResult(result);

      const resultMap: Record<string, SyncResult> = {};
      for (const r of result.results) {
        resultMap[r.sourceId] = r;
      }
      setSyncResults(resultMap);
      onMutate();
    } catch (err) {
      console.error('Failed to sync all sources:', err);
    } finally {
      setSyncingAll(false);
      setSyncingIds(new Set());
    }
  }

  const enabledSourcesWithUrls = sources.filter(
    (s) => s.enabled && ((s.config as any)?.url || (s.config as any)?.searchTerm),
  );

  return (
    <SettingsSection
      icon={<Globe className="h-5 w-5" />}
      title="Job Sources"
      description="Configure where Job Pilot searches for opportunities."
    >
      <div className="space-y-6">

        {/* Search Sources */}
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-600" />
              Search Sources
            </h4>
            {searchConfig && searchConfig.currentTitle && (
              <p className="text-xs text-muted-foreground mt-1">
                Auto-searching: <span className="font-medium text-foreground">{searchConfig.searchTerms?.[0] || searchConfig.currentTitle}</span>
                {searchConfig.location && <> in <span className="font-medium text-foreground">{searchConfig.location}</span></>}
              </p>
            )}
            {!searchConfig?.currentTitle && !loadingConfig && (
              <p className="text-xs text-muted-foreground mt-1">
                Complete your profile to auto-generate search terms.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEARCH_SOURCES.map((src) => {
              const isEnabled = sources.some((s) => s.type === src.type);
              const isEnabling = enablingType === src.type;
              const needsKey = 'requiresKey' in src;

              return (
                <button
                  key={src.type}
                  type="button"
                  disabled={isEnabling}
                  onClick={() => {
                    if (isEnabled) {
                      const existing = sources.find(s => s.type === src.type);
                      if (existing) setDeletingSourceId(existing.id);
                    } else {
                      handleEnableSource(src.type);
                    }
                  }}
                  className={`relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
                    isEnabled
                      ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200'
                      : 'border-muted hover:border-sky-300 hover:bg-muted/30'
                  }`}
                >
                  {isEnabling && (
                    <Loader2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 animate-spin text-sky-500" />
                  )}
                  {isEnabled && !isEnabling && (
                    <Check className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-sky-600" />
                  )}
                  <span className="text-xs font-medium">{src.label}</span>
                  <span className="text-[10px] text-muted-foreground">{src.description}</span>
                  {needsKey && !isEnabled && (
                    <span className="text-[10px] text-amber-600">needs key</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Active Sources + Sync */}
        {enabledSourcesWithUrls.length > 0 && (
          <div className="flex items-center justify-between rounded-md border border-sky-300 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Sync All Sources</p>
              <p className="text-xs text-muted-foreground">
                Fetch new jobs from {enabledSourcesWithUrls.length} enabled source{enabledSourcesWithUrls.length !== 1 ? 's' : ''}.
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="shrink-0 ml-4"
              onClick={handleSyncAll}
              disabled={syncingAll || syncingIds.size > 0}
            >
              {syncingAll ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Syncing...</>
              ) : (
                <><RefreshCw className="mr-1.5 h-4 w-4" />Sync All</>
              )}
            </Button>
          </div>
        )}

        {syncAllResult && <SyncAllSummary result={syncAllResult} />}

        {/* Active source list */}
        {sources.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No sources enabled yet. Click a search source above or add a custom URL.
          </p>
        )}

        {sources.map((source) => {
          const isSyncing = syncingIds.has(source.id);
          const result = syncResults[source.id];
          const error = syncErrors[source.id];
          const hasUrl = !!(source.config as any)?.url;

          return (
            <div key={source.id} className="rounded-md border">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(source.id, !source.enabled)}
                    className={`flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      source.enabled ? 'bg-green-500' : 'bg-muted'
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
                      <span className="text-sm font-medium truncate">{source.name}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase shrink-0">
                        {source.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(source.config as any)?.searchTerm && (
                        <p className="text-xs text-muted-foreground">
                          Search: "{(source.config as any).searchTerm}"
                          {(source.config as any)?.location && ` in ${(source.config as any).location}`}
                        </p>
                      )}
                      {(source.config as any)?.url && !(source.config as any)?.searchTerm && (
                        <p className="text-xs text-muted-foreground break-all">
                          {(source.config as any).url}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {source.lastSyncAt && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" title={new Date(source.lastSyncAt).toLocaleString()}>
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(source.lastSyncAt)}
                    </span>
                  )}
                  {(hasUrl || (source.config as any)?.searchTerm) && source.enabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground hover:text-sky-600"
                      onClick={() => handleSyncSource(source.id)}
                      disabled={isSyncing || syncingAll}
                      title="Sync this source now"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingSourceId(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {result && <SourceSyncResult result={result} />}
              {error && (
                <div className="border-t px-4 py-3 bg-white">
                  <div className="flex items-start gap-2 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p className="break-words whitespace-pre-wrap leading-relaxed">{error}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Delete Source Confirmation */}
        {(() => {
          const deletingSource = deletingSourceId ? sources.find((s) => s.id === deletingSourceId) : null;
          return (
            <AlertDialog open={!!deletingSourceId} onOpenChange={(open) => { if (!open) setDeletingSourceId(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Job Source?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {deletingSource
                      ? `Remove "${deletingSource.name}" from your job sources? This won't delete any jobs already imported from this source.`
                      : 'Remove this job source?'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (deletingSourceId) {
                        handleDelete(deletingSourceId);
                        setDeletingSourceId(null);
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        })()}

        {/* Add Custom Source button */}
        <Button variant="outline" size="sm" onClick={() => setShowAddCustom(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Custom URL Source
        </Button>

        {/* Add Custom Source Dialog */}
        <Dialog open={showAddCustom} onOpenChange={(open) => {
          setShowAddCustom(open);
          if (!open) { setCustomName(''); setCustomUrl(''); }
        }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Custom Source</DialogTitle>
              <DialogDescription>Track a specific job posting URL.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. Stripe Careers" value={customName} onChange={(e) => setCustomName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>URL (optional)</Label>
                <Input placeholder="https://example.com/jobs/12345" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddCustom(false)}>Cancel</Button>
                <Button size="sm" disabled={customSubmitting || !customName.trim()} onClick={handleAddCustom}>
                  {customSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Separator />

        {/* Job Board Directory */}
        <div className="space-y-3">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowDirectory(!showDirectory)}
          >
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Job Board Directory
                <Badge variant="secondary" className="text-[10px]">{JOB_BOARD_DIRECTORY.length}</Badge>
              </h4>
              <p className="text-xs text-muted-foreground">
                One-click add boards as sources. Search URLs are auto-built from your profile.
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showDirectory ? 'rotate-180' : ''}`} />
          </button>

          {showDirectory && (
            <div className="space-y-3">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search boards..."
                  value={boardSearch}
                  onChange={(e) => setBoardSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
                {boardSearch && (
                  <button
                    type="button"
                    onClick={() => setBoardSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Filtered boards */}
              <div className="grid gap-1.5 sm:grid-cols-2 max-h-[400px] overflow-y-auto">
                {JOB_BOARD_DIRECTORY
                  .filter((b) => {
                    if (!boardSearch) return true;
                    const q = boardSearch.toLowerCase();
                    return b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
                  })
                  .map((board) => {
                    const isAdded = addedBoards.has(board.name);
                    const isAdding = addingBoard === board.name;
                    return (
                      <div
                        key={board.name}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                          isAdded ? 'border-sky-300 bg-sky-50' : 'bg-card hover:bg-muted/50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{board.name}</span>
                            <Badge variant="secondary" className="text-[9px] shrink-0">{board.category}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">{board.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {isAdded ? (
                            <span className="flex items-center gap-1 text-xs text-sky-600 font-medium">
                              <Check className="h-3.5 w-3.5" />
                              Added
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleAddBoard(board)}
                              disabled={isAdding}
                            >
                              {isAdding ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              Add
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Sync Result Components
// ---------------------------------------------------------------------------

function SourceSyncResult({ result }: { result: SyncResult }) {
  const hasErrors = result.errors.length > 0;
  const [showErrors, setShowErrors] = React.useState(false);

  return (
    <div className={`border-t px-4 py-3 text-xs ${hasErrors ? 'bg-white border-amber-300' : 'bg-white border-emerald-300'}`}>
      <div className="flex items-center gap-3">
        {hasErrors ? (
          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span>
            <strong className="font-medium text-foreground">{result.newJobs}</strong> new
          </span>
          {result.duplicates > 0 && (
            <span>
              <strong className="font-medium text-foreground">{result.duplicates}</strong> already imported
            </span>
          )}
          {hasErrors && (
            <button
              type="button"
              onClick={() => setShowErrors((v) => !v)}
              className="text-amber-700 hover:underline cursor-pointer"
            >
              <strong className="font-medium">{result.errors.length}</strong> error{result.errors.length !== 1 ? 's' : ''}
              <span className="ml-1">{showErrors ? '▾' : '▸'}</span>
            </button>
          )}
        </div>
      </div>
      {hasErrors && showErrors && (
        <div className="mt-2 ml-6 space-y-1.5">
          {result.errors.map((err, i) => (
            <div key={i} className="rounded border border-amber-300 bg-white px-2.5 py-1.5">
              <p className="text-amber-700 break-words whitespace-pre-wrap text-[11px] leading-relaxed">
                {err}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SyncAllSummary({ result }: {
  result: {
    results: SyncResult[];
    totalNewJobs: number;
    totalErrors: number;
  };
}) {
  if (result.results.length === 0) {
    return (
      <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        No enabled sources with URLs to sync.
      </div>
    );
  }

  return (
    <div className={`rounded-md border p-3 text-sm ${result.totalErrors > 0 ? 'bg-white border-amber-300 text-amber-700' : 'bg-white border-emerald-300 text-emerald-700'}`}>
      <div className="flex items-start gap-2">
        {result.totalErrors > 0 ? (
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        )}
        <span className="break-words">
          Synced {result.results.length} source{result.results.length !== 1 ? 's' : ''}:
          {' '}<strong>{result.totalNewJobs}</strong> new job{result.totalNewJobs !== 1 ? 's' : ''} found
          {result.totalErrors > 0 && (
            <>, <strong>{result.totalErrors}</strong> error{result.totalErrors !== 1 ? 's' : ''}</>
          )}.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Management Section
// ---------------------------------------------------------------------------

function DataManagementSection() {
  const [rescoring, setRescoring] = React.useState(false);
  const [result, setResult] = React.useState<{ count: number; total: number } | null>(null);

  async function handleRescore() {
    setRescoring(true);
    setResult(null);
    try {
      const res = await api.ai.rescoreAll();
      setResult({ count: res.count, total: res.total ?? res.count });
    } catch (err) {
      console.error('Failed to rescore jobs:', err);
    } finally {
      setRescoring(false);
    }
  }

  return (
    <SettingsSection
      icon={<Database className="h-5 w-5" />}
      title="Data Management"
      description="Bulk operations and maintenance tools."
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Rescore All Jobs</p>
            <p className="text-xs text-muted-foreground">
              Re-run the AI scorer on every job against your current profile. This uses your
              Anthropic API key and may take a while for large job lists.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={handleRescore}
            disabled={rescoring}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${rescoring ? 'animate-spin' : ''}`} />
            {rescoring ? 'Rescoring...' : 'Rescore All'}
          </Button>
        </div>
        {result && (
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            Rescored {result.count} of {result.total} jobs successfully.
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Account Settings Section
// ---------------------------------------------------------------------------

function AccountSettingsSection({ session }: { session: any }) {
  const [displayName, setDisplayName] = React.useState(session?.user?.name || '');
  const [savingName, setSavingName] = React.useState(false);
  const [nameSaved, setNameSaved] = React.useState(false);
  const [nameError, setNameError] = React.useState('');

  const [showPasswordForm, setShowPasswordForm] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);

  async function handleSaveName() {
    setSavingName(true);
    setNameError('');
    setNameSaved(false);
    try {
      await authClient.updateUser({ name: displayName });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      await authClient.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <SettingsSection
      icon={<User className="h-5 w-5" />}
      title="Account Settings"
      description="Manage your account credentials and display name."
    >
      <div className="space-y-6">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="display-name">Display Name</Label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="max-w-xs"
            />
            <Button
              size="sm"
              onClick={handleSaveName}
              disabled={savingName || !displayName.trim()}
            >
              {savingName ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : nameSaved ? (
                <><CheckCircle2 className="mr-1.5 h-4 w-4" />Saved</>
              ) : (
                'Save'
              )}
            </Button>
          </div>
          {nameError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {nameError}
            </p>
          )}
          {nameSaved && !nameError && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Display name updated successfully.
            </p>
          )}
        </div>

        <Separator />

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label>Email (read-only)</Label>
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            {session?.user?.email || 'Not available'}
          </div>
        </div>

        <Separator />

        {/* Change Password */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                Update your account password.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowPasswordForm(!showPasswordForm);
                setPasswordError('');
                setPasswordSuccess(false);
                if (showPasswordForm) {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }
              }}
            >
              <Lock className="mr-1.5 h-4 w-4" />
              {showPasswordForm ? 'Cancel' : 'Change Password'}
            </Button>
          </div>

          {showPasswordForm && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Password changed successfully.
                </p>
              )}

              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Changing...</>
                ) : (
                  'Update Password'
                )}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Profile Link */}
        <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          For professional details (headline, experience, skills), visit your{' '}
          <Link to="/profile" className="font-medium text-sky-600 hover:underline">
            Pilot Profile
          </Link>
          .
        </div>
      </div>
    </SettingsSection>
  );
}

// ---------------------------------------------------------------------------
// Shared Section Wrapper
// ---------------------------------------------------------------------------

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  );
}
