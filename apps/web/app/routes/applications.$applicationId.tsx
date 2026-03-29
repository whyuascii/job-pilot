import React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Clock,
  MessageSquare,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Loader2,
  Check,
  X,
  Pencil,
  Search,
  AlertCircle,
  BookOpen,
  ThumbsUp,
  FileText,
} from 'lucide-react';
import { Button, Card, CardContent, Badge, Separator, Textarea } from '@job-pilot/ui';
import { StatusBadge, statusLabels } from '@job-pilot/ui';
import { api } from '~/lib/api-client';

// ---------------------------------------------------------------------------
// Route definition with loader
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/applications/$applicationId')({
  loader: async ({ params }) => {
    const [application, outcomes, questions] = await Promise.all([
      api.applications.get(params.applicationId),
      api.outcomes.list({ applicationId: params.applicationId }),
      api.answerAi.getQuestions(params.applicationId),
    ]);
    return { application, outcomes, questions };
  },
  component: ApplicationDetailPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApplicationDetail = Awaited<ReturnType<typeof api.applications.get>>;
type Outcome = Awaited<ReturnType<typeof api.outcomes.list>>[number];
type AppQuestion = Awaited<ReturnType<typeof api.answerAi.getQuestions>>[number];

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
// All valid statuses (free movement between any stage)
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

const CATEGORIES = ['Technical', 'Behavioral', 'Motivational', 'Logistical', 'Cultural'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: string | Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(date: string | Date | null): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

function confidenceBadgeVariant(confidence: string): 'default' | 'secondary' | 'outline' {
  switch (confidence) {
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
    default:
      return 'outline';
  }
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function ApplicationDetailPage() {
  const { application: app, outcomes, questions: initialQuestions } = Route.useLoaderData();
  const router = useRouter();

  const [changing, setChanging] = React.useState(false);
  const [statusNotes, setStatusNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [notesValue, setNotesValue] = React.useState(app.notes ?? '');

  const status = app.status as ApplicationStatus;
  const availableStatuses = ALL_STATUSES.filter((s) => s !== status);

  // ------- Handlers -------

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    try {
      await api.applications.updateStatus({
        applicationId: app.id,
        status: newStatus,
        ...(statusNotes.trim() ? { notes: statusNotes.trim() } : {}),
      });
      setChanging(false);
      setStatusNotes('');
      router.invalidate();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNotes() {
    setLoading(true);
    try {
      await api.applications.updateStatus({
        applicationId: app.id,
        status: app.status,
        notes: notesValue,
      });
      setEditingNotes(false);
      router.invalidate();
    } catch (err) {
      console.error('Failed to update notes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddOutcome() {
    if (!statusNotes.trim()) return;
    setLoading(true);
    try {
      await api.outcomes.add({
        applicationId: app.id,
        stage: app.status,
        notes: statusNotes.trim(),
      });
      setStatusNotes('');
      router.invalidate();
    } catch (err) {
      console.error('Failed to add outcome:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                             */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        {/* Back button */}
        <Link
          to="/applications"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>

        {/* Title & meta */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {app.job?.title ?? 'Unknown Position'}
            </h1>

            <div className="flex items-center gap-2 text-lg text-muted-foreground">
              <Building2 className="h-5 w-5 shrink-0" />
              <span>{app.job?.company ?? 'Unknown Company'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={status} />
              {app.appliedAt && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  Applied {formatDate(app.appliedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Job Info Card                                                      */}
      {/* ----------------------------------------------------------------- */}
      {app.job && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-lg font-semibold">Job Details</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Location */}
              {app.job.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{app.job.location}</span>
                  {app.job.remotePolicy && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {app.job.remotePolicy}
                    </Badge>
                  )}
                </div>
              )}

              {/* Compensation */}
              {formatCompensation(app.job.compensationMin, app.job.compensationMax) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">
                    {formatCompensation(app.job.compensationMin, app.job.compensationMax)}
                  </span>
                </div>
              )}
            </div>

            {/* Must-have skills */}
            {app.job.mustHaveSkills && (app.job.mustHaveSkills as string[]).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Must-Have Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(app.job.mustHaveSkills as string[]).map((skill: string) => (
                    <Badge key={skill} variant="default" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={`/jobs/${app.job.id}`}>
                  <ChevronRight className="h-4 w-4" />
                  View Job Details
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/jobs/$jobId" params={{ jobId: app.job.id }}>
                  <FileText className="h-4 w-4" />
                  View Tailored Resume
                </Link>
              </Button>
              {app.job.applyUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={app.job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Apply URL
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Answer Assistance (AI)                                             */}
      {/* ----------------------------------------------------------------- */}
      <AnswerAssistanceSection
        applicationId={app.id}
        initialQuestions={initialQuestions}
      />

      {/* ----------------------------------------------------------------- */}
      {/* Status Management -- free movement to any stage                    */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Status</h2>
            <StatusBadge status={status} />
          </div>

          <div className="space-y-3">
            {!changing ? (
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setChanging(true)}
                disabled={loading}
              >
                <span>Change Status</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Move to:
                </p>
                <div className="flex flex-wrap gap-2">
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
                      onClick={() => handleStatusChange(ns)}
                      disabled={loading}
                    >
                      {statusLabels[ns] ?? ns}
                      {ns !== 'rejected' && ns !== 'withdrawn' && (
                        <ArrowRight className="ml-1 h-3 w-3" />
                      )}
                    </Button>
                  ))}
                </div>

                {/* Optional notes for status change */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a note about this status change (optional)..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChanging(false);
                    setStatusNotes('');
                  }}
                  disabled={loading}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Timeline / History                                                 */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Status History</h2>
          </div>

          {outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No status history recorded yet.
            </p>
          ) : (
            <div className="relative space-y-0">
              {outcomes.map((outcome, idx) => (
                <div key={outcome.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Vertical line */}
                  {idx < outcomes.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
                  )}

                  {/* Dot */}
                  <div className="relative z-10 mt-1.5 h-[10px] w-[10px] shrink-0 rounded-full border-2 border-primary bg-background" />

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={outcome.stage as ApplicationStatus} />
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(outcome.occurredAt)}
                      </span>
                    </div>
                    {outcome.notes && (
                      <p className="text-sm text-muted-foreground">
                        {outcome.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add note to timeline */}
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              Add a note to the timeline
            </p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Enter a note..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={2}
                className="text-sm flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddOutcome}
                disabled={loading || !statusNotes.trim()}
                className="shrink-0 self-end"
              >
                Add Note
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Notes Section                                                      */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Notes</h2>
            </div>
            {!editingNotes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNotesValue(app.notes ?? '');
                  setEditingNotes(true);
                }}
              >
                Edit Notes
              </Button>
            )}
          </div>

          {editingNotes ? (
            <div className="space-y-3">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                rows={5}
                placeholder="Add notes about this application..."
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Notes'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingNotes(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              {app.notes ? (
                <p className="whitespace-pre-wrap leading-relaxed">{app.notes}</p>
              ) : (
                <p className="text-muted-foreground italic">
                  No notes yet. Click "Edit Notes" to add some.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Answer Assistance Section
// ---------------------------------------------------------------------------

interface AnswerAssistanceSectionProps {
  applicationId: string;
  initialQuestions: AppQuestion[];
}

function AnswerAssistanceSection({ applicationId, initialQuestions }: AnswerAssistanceSectionProps) {
  const router = useRouter();
  const [questions, setQuestions] = React.useState<AppQuestion[]>(initialQuestions);
  const [detecting, setDetecting] = React.useState(false);
  const [detectError, setDetectError] = React.useState('');
  const [generatingId, setGeneratingId] = React.useState<string | null>(null);
  const [generateError, setGenerateError] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<
    Record<
      string,
      {
        suggestedAnswer: string;
        confidence: string;
        sourceEvidence: string;
        reasoning: string;
        similarAnswers: Array<{ id: string; questionPattern: string; answerPreview: string }>;
      }
    >
  >({});
  const [editingAnswerId, setEditingAnswerId] = React.useState<string | null>(null);
  const [editedAnswer, setEditedAnswer] = React.useState('');
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [successId, setSuccessId] = React.useState<string | null>(null);
  const [saveCategory, setSaveCategory] = React.useState('Technical');

  // Initialize suggestions from existing question data
  React.useEffect(() => {
    const existing: typeof suggestions = {};
    for (const q of initialQuestions) {
      if (q.suggestedAnswer) {
        existing[q.id] = {
          suggestedAnswer: q.suggestedAnswer,
          confidence: q.confidence,
          sourceEvidence: q.sourceEvidence ?? '',
          reasoning: '',
          similarAnswers: [],
        };
      }
    }
    if (Object.keys(existing).length > 0) {
      setSuggestions((prev) => ({ ...prev, ...existing }));
    }
  }, [initialQuestions]);

  async function handleDetectQuestions() {
    setDetecting(true);
    setDetectError('');
    try {
      const detected = await api.answerAi.detectQuestions({
        applicationId,
      });
      setQuestions((prev) => [...prev, ...detected]);
      router.invalidate();
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : 'Failed to detect questions');
    } finally {
      setDetecting(false);
    }
  }

  async function handleGenerateAnswer(questionId: string, questionText: string) {
    setGeneratingId(questionId);
    setGenerateError('');
    try {
      const result = await api.answerAi.suggestAnswer({
        questionId,
        applicationId,
        questionText,
      });
      setSuggestions((prev) => ({
        ...prev,
        [questionId]: result,
      }));
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate answer');
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleApproveAndSave(questionId: string, questionText: string, answer: string) {
    setSavingId(questionId);
    try {
      await api.answerAi.approveAnswer({
        questionId,
        applicationId,
        finalAnswer: answer,
        category: saveCategory,
        questionText,
      });
      setSuccessId(questionId);
      setEditingAnswerId(null);
      setTimeout(() => setSuccessId(null), 3000);
      router.invalidate();
    } catch (err) {
      console.error('Failed to approve answer:', err);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDismiss(questionId: string) {
    try {
      await api.answerAi.dismissQuestion({ questionId });
      setSuggestions((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch (err) {
      console.error('Failed to dismiss question:', err);
    }
  }

  const approvedCount = questions.filter((q) => q.approved).length;
  const pendingCount = questions.filter((q) => !q.approved).length;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Answer Assistance</h2>
          </div>
          {questions.length > 0 && (
            <div className="flex items-center gap-2">
              {approvedCount > 0 && (
                <Badge variant="default" className="text-xs">
                  {approvedCount} saved
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {pendingCount} pending
                </Badge>
              )}
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Use AI to detect likely application questions and generate tailored answers
          based on your profile and answer bank.
        </p>

        {/* Detect Questions Button */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleDetectQuestions}
            disabled={detecting}
          >
            {detecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning Job Description...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Detect Questions
              </>
            )}
          </Button>
          {questions.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {questions.length} question{questions.length !== 1 ? 's' : ''} detected
            </span>
          )}
        </div>

        {detectError && (
          <div className="rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {detectError}
            </div>
          </div>
        )}

        {generateError && (
          <div className="rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {generateError}
            </div>
          </div>
        )}

        {/* Questions List */}
        {questions.length > 0 && (
          <div className="space-y-4">
            <Separator />
            {questions.map((q) => {
              const suggestion = suggestions[q.id];
              const isGenerating = generatingId === q.id;
              const isSaving = savingId === q.id;
              const isSuccess = successId === q.id;
              const isEditing = editingAnswerId === q.id;

              return (
                <div
                  key={q.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {q.question}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant={confidenceBadgeVariant(q.confidence)}
                          className="text-xs"
                        >
                          {q.confidence} likelihood
                        </Badge>
                        {q.approved && (
                          <Badge variant="default" className="text-xs bg-emerald-600">
                            <Check className="h-3 w-3 mr-1" />
                            Saved to Bank
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Generate Answer button */}
                    {!q.approved && !suggestion && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleGenerateAnswer(q.id, q.question)}
                        disabled={isGenerating}
                        className="shrink-0"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate Answer
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Success message */}
                  {isSuccess && (
                    <div className="rounded-lg border border-emerald-300 bg-white px-4 py-3 text-sm text-emerald-700">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        Answer approved and saved to your Black Box.
                      </div>
                    </div>
                  )}

                  {/* Suggested Answer Display */}
                  {suggestion && !q.approved && (
                    <div className="space-y-3">
                      {/* Confidence badge */}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={confidenceBadgeVariant(suggestion.confidence)}
                          className="text-xs"
                        >
                          {suggestion.confidence} confidence
                        </Badge>
                      </div>

                      {/* Answer content */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedAnswer}
                            onChange={(e) => setEditedAnswer(e.target.value)}
                            rows={6}
                            className="text-sm"
                            placeholder="Edit the suggested answer..."
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Category:
                            </label>
                            <select
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={saveCategory}
                              onChange={(e) => setSaveCategory(e.target.value)}
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleApproveAndSave(
                                  q.id,
                                  q.question,
                                  editedAnswer,
                                )
                              }
                              disabled={isSaving || !editedAnswer.trim()}
                            >
                              {isSaving ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Save to Bank
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingAnswerId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border bg-muted/50 px-4 py-3">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {suggestion.suggestedAnswer}
                          </p>
                        </div>
                      )}

                      {/* Source evidence */}
                      {suggestion.sourceEvidence && !isEditing && (
                        <div className="rounded-lg border border-sky-300 bg-white px-3 py-2">
                          <p className="text-xs font-medium text-sky-700 mb-1">
                            Source Evidence
                          </p>
                          <p className="text-xs text-sky-700">
                            {suggestion.sourceEvidence}
                          </p>
                        </div>
                      )}

                      {/* Similar answers from bank */}
                      {suggestion.similarAnswers && suggestion.similarAnswers.length > 0 && !isEditing && (
                        <div className="rounded-lg border px-3 py-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            <BookOpen className="h-3 w-3 inline mr-1" />
                            Similar answers in your Black Box
                          </p>
                          {suggestion.similarAnswers.map((sa) => (
                            <div key={sa.id} className="mt-1 text-xs text-muted-foreground">
                              <span className="font-medium">{sa.questionPattern}:</span>{' '}
                              {sa.answerPreview}...
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {!isEditing && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSaveCategory('Technical');
                              handleApproveAndSave(
                                q.id,
                                q.question,
                                suggestion.suggestedAnswer,
                              );
                            }}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <ThumbsUp className="h-3.5 w-3.5" />
                                Approve &amp; Save to Bank
                              </>
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingAnswerId(q.id);
                              setEditedAnswer(suggestion.suggestedAnswer);
                              setSaveCategory('Technical');
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit &amp; Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismiss(q.id)}
                            className="text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show final answer if approved */}
                  {q.approved && q.finalAnswer && (
                    <div className="rounded-lg border border-emerald-300 bg-white px-4 py-3">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed text-emerald-700">
                        {q.finalAnswer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {questions.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Click "Detect Questions" to scan the job description for likely application questions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
