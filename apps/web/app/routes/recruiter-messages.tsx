import React from 'react';

import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';

import {
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

interface EmailAnalysisResult {
  messageId: string;
  matchedApplicationId: string | null;
  matchedCompany: string | null;
  matchedJobTitle: string | null;
  detectedStatus: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function RecruiterMessagesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/recruiter-messages')({
  loader: async () => {
    const [messages, gmailStatus] = await Promise.all([
      api.emailAnalysis.listMessages(),
      api.gmail.getStatus(),
    ]);
    return { messages, gmailStatus };
  },
  component: RecruiterMessagesPage,
  pendingComponent: RecruiterMessagesSkeleton,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecruiterMessage = Awaited<ReturnType<typeof api.emailAnalysis.listMessages>>[number];

// ---------------------------------------------------------------------------
// Confidence Badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-white text-emerald-700 border border-emerald-300',
    medium: 'bg-white text-amber-700 border border-amber-300',
    low: 'bg-white text-muted-foreground border border-border',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${styles[level]}`}
    >
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

function extractSenderName(from: string): string {
  // "John Doe <john@example.com>" -> "John Doe"
  const match = from.match(/^(.+?)\s*</);
  if (match) return match[1].replace(/"/g, '');
  // "john@example.com" -> "john"
  const atIdx = from.indexOf('@');
  if (atIdx > 0) return from.slice(0, atIdx);
  return from;
}

// ---------------------------------------------------------------------------
// Analysis Result Card
// ---------------------------------------------------------------------------

function AnalysisResultCard({
  analysis,
  onApply,
  onDismiss,
  applying,
  dismissing,
}: {
  analysis: EmailAnalysisResult;
  onApply: () => void;
  onDismiss: () => void;
  applying: boolean;
  dismissing: boolean;
}) {
  const hasMatch = analysis.matchedApplicationId && analysis.detectedStatus;

  return (
    <div className="mt-3 rounded-lg border border-sky-300 bg-white p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1 space-y-2">
          {/* Analysis header */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">AI Analysis</span>
            <ConfidenceBadge level={analysis.confidence} />
          </div>

          {/* Reasoning */}
          <p className="text-muted-foreground text-xs leading-relaxed">{analysis.reasoning}</p>

          {/* Matched application info */}
          {hasMatch ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="text-muted-foreground h-3.5 w-3.5" />
                <span className="font-medium">{analysis.matchedCompany}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-muted-foreground truncate">{analysis.matchedJobTitle}</span>
                <ArrowRight className="text-muted-foreground h-3 w-3" />
                <StatusBadge status={analysis.detectedStatus as any} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onApply}
                  disabled={applying || dismissing}
                >
                  {applying ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  )}
                  Apply Change
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7 text-xs"
                  onClick={onDismiss}
                  disabled={applying || dismissing}
                >
                  {dismissing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <X className="mr-1 h-3 w-3" />
                  )}
                  Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs italic">
                No matching application found or no status change detected.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 text-xs"
                onClick={onDismiss}
                disabled={dismissing}
              >
                {dismissing ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <X className="mr-1 h-3 w-3" />
                )}
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Card
// ---------------------------------------------------------------------------

function MessageCard({
  message,
  analysis,
  onAnalyze,
  onApply,
  onDismiss,
  analyzing,
  applying,
  dismissing,
}: {
  message: RecruiterMessage;
  analysis: EmailAnalysisResult | null;
  onAnalyze: () => void;
  onApply: () => void;
  onDismiss: () => void;
  analyzing: boolean;
  applying: boolean;
  dismissing: boolean;
}) {
  const senderName = extractSenderName(message.from);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        {/* Message header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold leading-tight">{message.subject}</p>
              {message.parsed && !analysis && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Processed
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{senderName}</span>
              <span className="text-muted-foreground/50">|</span>
              <span className="shrink-0">{formatDate(message.receivedAt)}</span>
            </div>
            <p className="text-muted-foreground/80 line-clamp-2 text-xs leading-relaxed">
              {message.snippet}
            </p>
          </div>

          {/* Analyze button */}
          {!message.parsed && !analysis && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              onClick={onAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="mr-1 h-3 w-3" />
                  Analyze
                </>
              )}
            </Button>
          )}
        </div>

        {/* Analysis result (if available) */}
        {analysis && (
          <AnalysisResultCard
            analysis={analysis}
            onApply={onApply}
            onDismiss={onDismiss}
            applying={applying}
            dismissing={dismissing}
          />
        )}

        {/* Linked application */}
        {message.parsed && message.applicationId && !analysis && (
          <div className="mt-2 border-t pt-2">
            <Link
              to="/applications/$applicationId"
              params={{ applicationId: message.applicationId }}
              className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700"
            >
              View linked application
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'unprocessed' | 'processed';

function RecruiterMessagesPage() {
  const { messages, gmailStatus } = Route.useLoaderData();
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<FilterTab>('all');
  const [analysisResults, setAnalysisResults] = React.useState<Record<string, EmailAnalysisResult>>(
    {},
  );
  const [analyzingIds, setAnalyzingIds] = React.useState<Set<string>>(new Set());
  const [applyingIds, setApplyingIds] = React.useState<Set<string>>(new Set());
  const [dismissingIds, setDismissingIds] = React.useState<Set<string>>(new Set());
  const [batchAnalyzing, setBatchAnalyzing] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  // Filter messages based on active tab
  const filteredMessages = React.useMemo(() => {
    switch (activeTab) {
      case 'unprocessed':
        return messages.filter((m) => !m.parsed);
      case 'processed':
        return messages.filter((m) => m.parsed);
      default:
        return messages;
    }
  }, [messages, activeTab]);

  const unprocessedCount = messages.filter((m) => !m.parsed).length;

  // -- Handlers --

  async function handleSync() {
    setSyncing(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await api.gmail.syncMessages();
      setSuccessMsg(
        `Synced ${result.total} messages: ${result.synced} new, ${result.skipped} already imported.`,
      );
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync messages.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze(messageId: string) {
    setAnalyzingIds((prev) => new Set([...prev, messageId]));
    setError('');
    try {
      const result = await api.emailAnalysis.analyze({ messageId });
      setAnalysisResults((prev) => ({ ...prev, [messageId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }

  async function handleAnalyzeAll() {
    setBatchAnalyzing(true);
    setError('');
    setSuccessMsg('');
    try {
      const result = await api.emailAnalysis.analyzeUnprocessed();
      const newResults: Record<string, EmailAnalysisResult> = {};
      for (const r of result.results) {
        newResults[r.messageId] = r;
      }
      setAnalysisResults((prev) => ({ ...prev, ...newResults }));

      const matchCount = result.results.filter((r) => r.matchedApplicationId).length;
      setSuccessMsg(
        `Analyzed ${result.results.length} of ${result.total} messages. ${matchCount} matched to applications.${
          result.errors ? ` ${result.errors.length} failed.` : ''
        }`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch analysis failed.');
    } finally {
      setBatchAnalyzing(false);
    }
  }

  async function handleApply(analysis: EmailAnalysisResult) {
    if (!analysis.matchedApplicationId || !analysis.detectedStatus) return;

    setApplyingIds((prev) => new Set([...prev, analysis.messageId]));
    setError('');
    try {
      await api.emailAnalysis.applyStatus({
        messageId: analysis.messageId,
        applicationId: analysis.matchedApplicationId,
        newStatus: analysis.detectedStatus,
      });
      // Remove analysis and refresh
      setAnalysisResults((prev) => {
        const next = { ...prev };
        delete next[analysis.messageId];
        return next;
      });
      setSuccessMsg(
        `Updated ${analysis.matchedCompany} to ${statusLabels[analysis.detectedStatus] ?? analysis.detectedStatus}.`,
      );
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply status change.');
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev);
        next.delete(analysis.messageId);
        return next;
      });
    }
  }

  async function handleDismiss(messageId: string) {
    setDismissingIds((prev) => new Set([...prev, messageId]));
    setError('');
    try {
      await api.emailAnalysis.dismiss({ messageId });
      setAnalysisResults((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss.');
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }

  // -- Empty state: Gmail not connected --
  if (!gmailStatus.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comms Intercept</h1>
          <p className="text-muted-foreground">
            Analyze recruiter emails to detect application status changes.
          </p>
        </div>
        <div className="bg-card flex flex-col items-center justify-center rounded-xl border py-20 shadow">
          <Mail className="text-muted-foreground/20 mb-4 h-16 w-16" />
          <h3 className="mb-1 text-lg font-semibold">Gmail not connected</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-center text-sm">
            Connect your Gmail account in Settings to sync recruiter messages and auto-detect
            application status changes.
          </p>
          <Button asChild>
            <Link to="/settings">Go to Settings</Link>
          </Button>
        </div>
      </div>
    );
  }

  // -- Empty state: No messages --
  if (messages.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comms Intercept</h1>
          <p className="text-muted-foreground">
            Analyze recruiter emails to detect application status changes.
          </p>
        </div>
        <div className="bg-card flex flex-col items-center justify-center rounded-xl border py-20 shadow">
          <Inbox className="text-muted-foreground/20 mb-4 h-16 w-16" />
          <h3 className="mb-1 text-lg font-semibold">No messages yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-center text-sm">
            Sync your Gmail to import recruiter messages. Messages matching recruiter patterns from
            the last 7 days will be imported.
          </p>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Sync Messages
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // -- Main content --
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Comms Intercept</h1>
          <p className="text-muted-foreground">
            Analyze recruiter emails to detect application status changes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-card rounded-lg border px-3 py-1.5 text-center shadow-sm">
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="text-lg font-bold">{messages.length}</p>
          </div>
          {unprocessedCount > 0 && (
            <div className="bg-card rounded-lg border px-3 py-1.5 text-center shadow-sm">
              <p className="text-muted-foreground text-xs">Unprocessed</p>
              <p className="text-lg font-bold text-amber-800">{unprocessedCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter tabs */}
        <div className="flex gap-2">
          {(
            [
              { key: 'all', label: 'All', count: messages.length },
              { key: 'unprocessed', label: 'Unprocessed', count: unprocessedCount },
              { key: 'processed', label: 'Processed', count: messages.length - unprocessedCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {tab.label}
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeTab === tab.key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing || batchAnalyzing}
          >
            {syncing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Sync Gmail
              </>
            )}
          </Button>
          {unprocessedCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleAnalyzeAll}
              disabled={batchAnalyzing || syncing}
            >
              {batchAnalyzing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Analyze All ({Math.min(unprocessedCount, 10)})
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Success message */}
      {successMsg && (
        <div className="rounded-md border border-emerald-300 bg-white p-3 text-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
            <button
              onClick={() => setSuccessMsg('')}
              className="ml-auto text-emerald-600 hover:text-emerald-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-md border border-red-300 bg-white p-3 text-sm">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages list */}
      {filteredMessages.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center rounded-xl border py-16 shadow">
          <Inbox className="text-muted-foreground/20 mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm">No messages in this category.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            Showing {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
          </p>
          {filteredMessages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              analysis={analysisResults[msg.id] ?? null}
              onAnalyze={() => handleAnalyze(msg.id)}
              onApply={() => {
                const analysis = analysisResults[msg.id];
                if (analysis) handleApply(analysis);
              }}
              onDismiss={() => handleDismiss(msg.id)}
              analyzing={analyzingIds.has(msg.id)}
              applying={applyingIds.has(msg.id)}
              dismissing={dismissingIds.has(msg.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
