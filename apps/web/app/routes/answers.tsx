import * as React from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Check,
  Hash,
  Clock,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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

// ─── Route Definition ────────────────────────────────────────────────────────

export const Route = createFileRoute('/answers')({
  loader: () => api.answers.list(),
  component: AnswersPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type Answer = Awaited<ReturnType<typeof api.answers.list>>[number];

// ─── Pagination ─────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'Technical', label: 'Technical' },
  { value: 'Behavioral', label: 'Behavioral' },
  { value: 'Motivational', label: 'Motivational' },
  { value: 'Logistical', label: 'Logistical' },
  { value: 'Cultural', label: 'Cultural' },
];

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

function categoryBadgeVariant(
  category: string
): 'default' | 'secondary' | 'outline' {
  switch (category) {
    case 'Technical':
      return 'default';
    case 'Behavioral':
      return 'secondary';
    case 'Motivational':
    case 'Cultural':
      return 'outline';
    default:
      return 'secondary';
  }
}

// ─── Success Banner Component ────────────────────────────────────────────────

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-white px-4 py-3 text-sm text-emerald-700">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4" />
        {message}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type SimilarResult = Awaited<ReturnType<typeof api.answerAi.searchSimilar>>[number];

function AnswersPage() {
  const answers = Route.useLoaderData();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = React.useState<string>('All');
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState('');
  const [visibleCount, setVisibleCount] = React.useState(ITEMS_PER_PAGE);

  // Find Similar state
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<SimilarResult[]>([]);
  const [searchError, setSearchError] = React.useState('');
  const [hasSearched, setHasSearched] = React.useState(false);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  async function handleSearch() {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) return;
    setSearching(true);
    setSearchError('');
    setHasSearched(true);
    try {
      const results = await api.answerAi.searchSimilar({
        searchText: searchQuery.trim(),
      });
      setSearchResults(results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleFindSimilar(questionPattern: string) {
    setSearchQuery(questionPattern);
    setShowSearch(true);
    // Trigger search automatically
    setSearching(true);
    setSearchError('');
    setHasSearched(true);
    api.answerAi.searchSimilar({ searchText: questionPattern })
      .then((results) => setSearchResults(results))
      .catch((err) => {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
        setSearchResults([]);
      })
      .finally(() => setSearching(false));
  }

  // Derive all unique categories from data, merging with standard ones
  const allCategories = React.useMemo(() => {
    const customCategories = new Set<string>();
    for (const answer of answers) {
      if (!CATEGORY_VALUES.includes(answer.category)) {
        customCategories.add(answer.category);
      }
    }
    return [
      'All',
      ...CATEGORY_VALUES,
      ...Array.from(customCategories).sort(),
    ];
  }, [answers]);

  // Filter answers
  const filteredAnswers = React.useMemo(() => {
    if (activeFilter === 'All') return answers;
    return answers.filter((a) => a.category === activeFilter);
  }, [answers, activeFilter]);

  // Reset visible count when filter changes
  React.useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [activeFilter]);

  // Paginate the filtered answers
  const visibleAnswers = React.useMemo(
    () => filteredAnswers.slice(0, visibleCount),
    [filteredAnswers, visibleCount],
  );

  const hasMore = visibleCount < filteredAnswers.length;

  // Group visible answers by category
  const grouped = React.useMemo(() => {
    const map = new Map<string, Answer[]>();
    for (const answer of visibleAnswers) {
      if (!map.has(answer.category)) map.set(answer.category, []);
      map.get(answer.category)!.push(answer);
    }
    return map;
  }, [visibleAnswers]);

  // ─── CRUD handlers ──────────────────────────────────────────────────────

  async function handleAdd(form: AnswerFormState) {
    setLoading(true);
    try {
      await api.answers.add({
        questionPattern: form.questionPattern,
        category: form.category,
        answer: form.answer,
        context: form.context || undefined,
      });
      setShowAddForm(false);
      showSuccess('Answer saved to the Black Box.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string, form: AnswerFormState) {
    setLoading(true);
    try {
      await api.answers.update({
        answerId: id,
        questionPattern: form.questionPattern,
        category: form.category,
        answer: form.answer,
        context: form.context || undefined,
      });
      setEditingId(null);
      showSuccess('Answer updated successfully.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      await api.answers.delete({ answerId: id });
      setDeletingId(null);
      showSuccess('Answer deleted.');
      router.invalidate();
    } catch {
      // handled inline
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Black Box</h1>
            <p className="text-muted-foreground">
              Your library of reusable application answers.
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {allCategories.map((cat) => {
          const isActive = activeFilter === cat;
          const count =
            cat === 'All'
              ? answers.length
              : answers.filter((a) => a.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {cat}
              <span
                className={`text-xs ${
                  isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                }`}
              >
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {success && <SuccessBanner message={success} />}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="h-4 w-4" />
          Add Answer
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowSearch(true)}
        >
          <Search className="h-4 w-4" />
          Find Similar
        </Button>
      </div>

      {/* Find Similar Dialog */}
      <Dialog open={showSearch} onOpenChange={(open) => {
        setShowSearch(open);
        if (!open) {
          setSearchResults([]);
          setSearchQuery('');
          setHasSearched(false);
          setSearchError('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Find Similar Answers</DialogTitle>
            <DialogDescription>Search your answer bank for similar past answers by keyword or question.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter a question or keywords to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={searching || searchQuery.trim().length < 3}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>

            {searchError && (
              <div className="rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {searchError}
                </div>
              </div>
            )}

            {hasSearched && !searching && searchResults.length === 0 && !searchError && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No similar answers found. Try different keywords.
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground">
                  {searchResults.length} similar answer{searchResults.length !== 1 ? 's' : ''} found
                </p>
                {searchResults.map((result) => (
                  <div key={result.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{result.questionPattern}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={categoryBadgeVariant(result.category)} className="text-xs">{result.category}</Badge>
                          <Badge variant="outline" className="text-xs">{result.relevance}% match</Badge>
                          <span className="text-xs text-muted-foreground">Used {result.timesUsed} time{result.timesUsed !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{truncate(result.answer, 250)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Answer Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Answer</DialogTitle>
            <DialogDescription>Save a reusable answer for common application questions.</DialogDescription>
          </DialogHeader>
          <AnswerForm
            initial={emptyAnswerForm}
            loading={loading}
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {answers.length === 0 && !showAddForm && (
        <Card className="rounded-xl shadow">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <BookOpen className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="font-semibold text-lg mb-1">
              Your Black Box is empty
            </h3>
            <p className="text-sm text-muted-foreground max-w-md text-center mb-2">
              Every great pilot keeps a Black Box. Record your best answers to
              common interview and application questions here so you can deploy
              them instantly on future missions.
            </p>
            <p className="text-xs text-muted-foreground max-w-sm text-center mb-6">
              Tip: Start with a &quot;Tell me about yourself&quot; answer -- it is the
              most reused response across applications.
            </p>
            <Button onClick={() => setShowAddForm(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Record Your First Answer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No results for filter */}
      {answers.length > 0 && filteredAnswers.length === 0 && (
        <Card className="rounded-xl shadow">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="font-medium mb-1">No answers in this category</p>
            <p className="text-sm text-muted-foreground">
              Try selecting a different filter or add a new answer.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Showing X of Y */}
      {filteredAnswers.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {visibleAnswers.length} of {filteredAnswers.length} answer{filteredAnswers.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Edit Answer Dialog */}
      {(() => {
        const editingAnswer = editingId ? filteredAnswers.find((a) => a.id === editingId) ?? answers.find((a) => a.id === editingId) : null;
        return (
          <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Answer</DialogTitle>
              </DialogHeader>
              {editingAnswer && (
                <AnswerForm
                  initial={{
                    questionPattern: editingAnswer.questionPattern,
                    category: editingAnswer.category,
                    answer: editingAnswer.answer,
                    context: editingAnswer.context ?? '',
                  }}
                  loading={loading}
                  onSubmit={(form) => handleUpdate(editingAnswer.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Delete Answer Confirmation */}
      {(() => {
        const deletingAnswer = deletingId ? filteredAnswers.find((a) => a.id === deletingId) ?? answers.find((a) => a.id === deletingId) : null;
        return (
          <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Answer?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deletingAnswer
                    ? `This will permanently remove your answer for "${truncate(deletingAnswer.questionPattern, 60)}".`
                    : 'This will permanently remove this answer.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deletingId && handleDelete(deletingId)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={loading}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* Answer Cards grouped by category */}
      {Array.from(grouped.entries()).map(([category, categoryAnswers]) => (
        <div key={category} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{category}</h2>
            <Badge variant="secondary">{categoryAnswers.length}</Badge>
          </div>

          {categoryAnswers.map((answer) => (
            <Card key={answer.id} className="rounded-xl shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Question Pattern */}
                    <h3 className="font-semibold text-sm leading-snug">
                      {answer.questionPattern}
                    </h3>

                    {/* Metadata row */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <Badge variant={categoryBadgeVariant(answer.category)}>
                        {answer.category}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Hash className="h-3 w-3" />
                        Used {answer.timesUsed} time
                        {answer.timesUsed !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Last used: {formatDate(answer.lastUsed)}
                      </span>
                    </div>

                    {/* Truncated answer preview */}
                    <p className="mt-3 text-sm text-muted-foreground">
                      {expandedId === answer.id
                        ? answer.answer
                        : truncate(answer.answer, 180)}
                    </p>

                    {/* Context note */}
                    {expandedId === answer.id && answer.context && (
                      <div className="mt-3 rounded-lg border bg-muted/50 px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Context / Usage Notes
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {answer.context}
                        </p>
                      </div>
                    )}

                    {/* Expand / Collapse toggle */}
                    {(answer.answer.length > 180 || answer.context) && (
                      <button
                        onClick={() => toggleExpand(answer.id)}
                        className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {expandedId === answer.id ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Show more
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleFindSimilar(answer.questionPattern)}
                      title="Find similar answers"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingId(answer.id);
                        setExpandedId(null);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingId(answer.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {/* Show More button */}
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

// ─── Answer Form ─────────────────────────────────────────────────────────────

interface AnswerFormState {
  questionPattern: string;
  category: string;
  answer: string;
  context: string;
}

const emptyAnswerForm: AnswerFormState = {
  questionPattern: '',
  category: 'Technical',
  answer: '',
  context: '',
};

function AnswerForm({
  initial,
  loading,
  onSubmit,
  onCancel,
}: {
  initial: AnswerFormState;
  loading: boolean;
  onSubmit: (form: AnswerFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<AnswerFormState>(initial);

  function updateField(field: keyof AnswerFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-4">
      {/* Question Pattern */}
      <div className="space-y-2">
        <Label>Question Pattern *</Label>
        <textarea
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder='e.g. "Tell me about a time you led a team through a difficult project"'
          value={form.questionPattern}
          onChange={(e) => updateField('questionPattern', e.target.value)}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category *</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form.category}
          onChange={(e) => updateField('category', e.target.value)}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Answer */}
      <div className="space-y-2">
        <Label>Answer *</Label>
        <textarea
          rows={6}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Write your reusable answer here. Be thorough -- you can always trim it for specific applications."
          value={form.answer}
          onChange={(e) => updateField('answer', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {form.answer.length} characters
        </p>
      </div>

      {/* Context (optional) */}
      <div className="space-y-2">
        <Label>Context / Usage Notes (optional)</Label>
        <textarea
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="e.g. Best for senior-level roles, pair with project X example..."
          value={form.context}
          onChange={(e) => updateField('context', e.target.value)}
        />
      </div>

      <Separator />

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button
          type="button"
          disabled={loading || !form.questionPattern || !form.answer || !form.category}
          onClick={() => onSubmit(form)}
        >
          <Save className="h-4 w-4" />
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
