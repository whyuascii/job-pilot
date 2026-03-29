import React from 'react';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import {
  GraduationCap,
  Building2,
  MapPin,
  Trash2,
  TrendingUp,
  Rocket,
  Loader2,
  RefreshCw,
  Plane,
  Compass,
  Target,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Clock,
  Square,
  CheckSquare,
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
  Skeleton,
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

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function CareerGoalsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>
      <Separator />
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/career-goals')({
  loader: async () => {
    const [goals, coachingPlan] = await Promise.all([
      api.careerGoals.list(),
      api.careerGoals.getCoachingPlan(),
    ]);
    return { goals, coachingPlan };
  },
  component: CareerGoalsPage,
  pendingComponent: CareerGoalsSkeleton,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReadinessColor(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-sky-600';
  if (score >= 25) return 'text-amber-600';
  return 'text-red-600';
}

function getReadinessBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-sky-500';
  if (score >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

function getPriorityColor(priority: string): 'destructive' | 'warning' | 'secondary' {
  if (priority === 'critical') return 'destructive';
  if (priority === 'important') return 'warning';
  return 'secondary';
}

function getLevelWidth(level: string): string {
  switch (level) {
    case 'none': return 'w-0';
    case 'beginner': return 'w-1/4';
    case 'intermediate': return 'w-1/2';
    case 'advanced': return 'w-3/4';
    case 'expert': return 'w-full';
    default: return 'w-0';
  }
}

// ---------------------------------------------------------------------------
// Career Direction Section
// ---------------------------------------------------------------------------

function CareerDirectionCard({ plan }: { plan: any }) {
  const direction = plan.careerDirection;
  if (!direction) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Compass className="h-5 w-5 text-sky-500" />
              Career Direction
            </CardTitle>
            <CardDescription className="mt-2 text-sm leading-relaxed">
              {direction.summary}
            </CardDescription>
          </div>
          {plan.readinessScore != null && (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`text-3xl font-bold tabular-nums ${getReadinessColor(plan.readinessScore)}`}>
                {plan.readinessScore}
              </div>
              <div className="flex items-center gap-1">
                <div className={`h-1.5 w-12 rounded-full bg-muted overflow-hidden`}>
                  <div
                    className={`h-full rounded-full transition-all ${getReadinessBg(plan.readinessScore)}`}
                    style={{ width: `${plan.readinessScore}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Readiness</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          {(direction.themes ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Themes</p>
              <div className="flex flex-wrap gap-1.5">
                {direction.themes.map((theme: string) => (
                  <Badge key={theme} variant="secondary">{theme}</Badge>
                ))}
              </div>
            </div>
          )}
          {direction.targetLevel && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Target Level</p>
              <Badge variant="default" className="capitalize">{direction.targetLevel}</Badge>
            </div>
          )}
          {(direction.industries ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Industries</p>
              <div className="flex flex-wrap gap-1.5">
                {direction.industries.map((ind: string) => (
                  <Badge key={ind} variant="secondary">{ind}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Strength Alignment Section
// ---------------------------------------------------------------------------

function StrengthAlignmentCard({ strengths }: { strengths: any[] }) {
  if (!strengths || strengths.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Your Strengths
        </CardTitle>
        <CardDescription>Skills and experience that already align with your target roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {strengths.map((item: any, idx: number) => (
          <div key={idx} className="flex gap-3 items-start">
            <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{item.strength}</p>
              <p className="text-xs text-muted-foreground">{item.relevance}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skill Roadmap Section
// ---------------------------------------------------------------------------

function SkillRoadmapCard({ skills }: { skills: any[] }) {
  if (!skills || skills.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-sky-500" />
          Skill Roadmap
        </CardTitle>
        <CardDescription>Prioritized skills based on patterns across all your target roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skills.map((skill: any, idx: number) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{skill.skill}</span>
              <Badge variant={getPriorityColor(skill.priority)} className="text-[10px]">
                {skill.priority}
              </Badge>
            </div>
            {/* Level indicator */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{skill.currentLevel ?? 'none'}</span>
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium text-foreground">{skill.targetLevel}</span>
              </div>
              <div className="flex gap-1 h-1.5">
                <div className="flex-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full bg-sky-400 ${getLevelWidth(skill.currentLevel ?? 'none')}`} />
                </div>
              </div>
            </div>
            {skill.rationale && (
              <p className="text-xs text-muted-foreground">{skill.rationale}</p>
            )}
            {skill.howToLearn && (
              <p className="text-xs text-sky-700 dark:text-sky-400">{skill.howToLearn}</p>
            )}
            {idx < skills.length - 1 && <Separator className="mt-2" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Career Trajectory Section
// ---------------------------------------------------------------------------

function CareerTrajectoryCard({ trajectory }: { trajectory: any[] }) {
  if (!trajectory || trajectory.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-violet-500" />
          Career Trajectory
        </CardTitle>
        <CardDescription>Your phased roadmap toward these target roles</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-6">
          {/* Timeline line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

          {trajectory.map((phase: any, idx: number) => (
            <div key={idx} className="relative pl-9">
              {/* Timeline dot */}
              <div className={`absolute left-1.5 top-1 h-3 w-3 rounded-full border-2 border-background ${
                idx === 0 ? 'bg-sky-500' : idx === trajectory.length - 1 ? 'bg-violet-500' : 'bg-amber-500'
              }`} />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{phase.phase}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {phase.timeframe}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{phase.focus}</p>
                {(phase.milestones ?? []).length > 0 && (
                  <ul className="space-y-1">
                    {phase.milestones.map((milestone: string, mIdx: number) => (
                      <li key={mIdx} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                        <span>{milestone}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Project Ideas Section
// ---------------------------------------------------------------------------

function ProjectIdeasCard({ projects }: { projects: any[] }) {
  if (!projects || projects.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4 text-orange-500" />
          Portfolio Project Ideas
        </CardTitle>
        <CardDescription>Projects that demonstrate skills relevant to multiple target roles</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.map((project: any, idx: number) => (
          <div key={idx} className="space-y-2">
            <p className="text-sm font-medium">{project.name}</p>
            <p className="text-xs text-muted-foreground">{project.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {(project.skillsGained ?? []).map((s: string) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
            </div>
            {project.relevantToJobs && (
              <p className="text-[11px] text-muted-foreground italic">Relevant to: {project.relevantToJobs}</p>
            )}
            {idx < projects.length - 1 && <Separator className="mt-2" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Key Insight Section
// ---------------------------------------------------------------------------

function KeyInsightCard({ insight }: { insight: string }) {
  if (!insight) return null;

  return (
    <Card className="border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20">
      <CardContent className="pt-6">
        <div className="flex gap-3 items-start">
          <Lightbulb className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wide mb-1">Key Insight</p>
            <p className="text-sm leading-relaxed">{insight}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Coaching Plan View (unified)
// ---------------------------------------------------------------------------

function CoachingPlanView({ plan }: { plan: any }) {
  return (
    <div className="space-y-4">
      <CareerDirectionCard plan={plan} />

      {plan.keyInsight && <KeyInsightCard insight={plan.keyInsight} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StrengthAlignmentCard strengths={plan.strengthAlignment} />
        <SkillRoadmapCard skills={plan.skillRoadmap} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CareerTrajectoryCard trajectory={plan.careerTrajectory} />
        <ProjectIdeasCard projects={plan.projectIdeas} />
      </div>

      {/* Metadata */}
      {(plan.generatedAt || plan.jobCount) && (
        <p className="text-xs text-muted-foreground text-right">
          {plan.jobCount && `Based on ${plan.jobCount} saved role${plan.jobCount > 1 ? 's' : ''}`}
          {plan.generatedAt && plan.jobCount && ' · '}
          {plan.generatedAt && `Generated ${new Date(plan.generatedAt).toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple Aspirational Job Card (input to coaching plan)
// ---------------------------------------------------------------------------

function AspirationalJobCard({
  goal,
  onRequestDelete,
  onToggleSelected,
}: {
  goal: any;
  onRequestDelete: (id: string) => void;
  onToggleSelected: (id: string, selected: boolean) => void;
}) {
  const isSelected = goal.selectedForCoaching;

  return (
    <Card className={`transition-shadow hover:shadow-sm ${isSelected ? 'border-sky-300 dark:border-sky-700 bg-sky-50/30 dark:bg-sky-950/10' : 'opacity-60'}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Selection toggle */}
          <button
            onClick={() => onToggleSelected(goal.id, !isSelected)}
            className="shrink-0 text-sky-500 hover:text-sky-600 transition-colors"
            aria-label={isSelected ? 'Deselect for coaching' : 'Select for coaching'}
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {goal.job?.id ? (
                <Link
                  to="/jobs/$jobId"
                  params={{ jobId: goal.job.id }}
                  className="truncate font-medium text-sm hover:text-primary transition-colors"
                >
                  {goal.job.title}
                </Link>
              ) : (
                <p className="truncate font-medium text-sm">Unknown Position</p>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{goal.job?.company ?? 'Unknown Company'}</span>
              </div>
              {goal.job?.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{goal.job.location}</span>
                </div>
              )}
              {goal.job?.remotePolicy && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {goal.job.remotePolicy}
                </Badge>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onRequestDelete(goal.id)}
            aria-label="Remove aspirational role"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function CareerGoalsPage() {
  const { goals, coachingPlan } = Route.useLoaderData();
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [selectionError, setSelectionError] = React.useState<string | null>(null);

  const selectedCount = React.useMemo(
    () => goals.filter((g: any) => g.selectedForCoaching).length,
    [goals],
  );

  const deletingGoal = React.useMemo(
    () => (deletingId ? goals.find((g: any) => g.id === deletingId) : null),
    [deletingId, goals],
  );

  const handleDelete = async (goalId: string) => {
    setDeletingId(null);
    await api.careerGoals.delete({ goalId });
    router.invalidate();
  };

  const handleToggleSelected = async (goalId: string, selected: boolean) => {
    setSelectionError(null);
    if (selected && selectedCount >= 10) {
      setSelectionError('Maximum of 10 roles can be selected for coaching. Deselect one first.');
      return;
    }
    try {
      await api.careerGoals.toggleSelected({ goalId, selected });
      router.invalidate();
    } catch (err: any) {
      setSelectionError(err.message || 'Failed to update selection');
    }
  };

  const handleSelectAll = async () => {
    setSelectionError(null);
    const unselected = goals.filter((g: any) => !g.selectedForCoaching);
    const toSelect = unselected.slice(0, 10 - selectedCount);
    for (const goal of toSelect) {
      await api.careerGoals.toggleSelected({ goalId: goal.id, selected: true });
    }
    router.invalidate();
  };

  const handleDeselectAll = async () => {
    setSelectionError(null);
    const selected = goals.filter((g: any) => g.selectedForCoaching);
    for (const goal of selected) {
      await api.careerGoals.toggleSelected({ goalId: goal.id, selected: false });
    }
    router.invalidate();
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      await api.careerGoals.generateCoachingPlan();
      router.invalidate();
    } catch (err) {
      console.error('Failed to generate coaching plan:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Empty state
  if (!goals || goals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Career Coach</h1>
          <p className="text-muted-foreground">
            Your AI-powered career advisor analyzes all your aspirational roles.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-20 shadow">
          <Compass className="mb-4 h-16 w-16 text-muted-foreground/20" />
          <h3 className="mb-1 text-lg font-semibold">No aspirational roles saved</h3>
          <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
            Browse jobs and save roles you aspire to. Your career coach will analyze
            the patterns across all saved roles and create a unified growth plan.
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

  return (
    <div className="space-y-8">
      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Aspirational Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deletingGoal ? `"${deletingGoal.job?.title ?? 'this role'}" at ${deletingGoal.job?.company ?? 'unknown company'}` : 'this role'} from your career goals. You may want to regenerate your coaching plan afterward.
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
          <h1 className="text-3xl font-bold tracking-tight">Career Coach</h1>
          <p className="text-muted-foreground">
            Your AI-powered career advisor analyzes all your aspirational roles.
          </p>
        </div>

        <Button
          onClick={handleGeneratePlan}
          disabled={generating || selectedCount === 0}
          size="default"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : coachingPlan ? (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh Plan from {selectedCount} Role{selectedCount !== 1 ? 's' : ''}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Plan from {selectedCount} Role{selectedCount !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>

      <Separator />

      {/* Coaching Plan Section */}
      {coachingPlan ? (
        <CoachingPlanView plan={coachingPlan} />
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <h3 className="mb-1 text-base font-semibold">No coaching plan yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground mb-4">
                {selectedCount > 0
                  ? `Click below to have your AI career coach analyze the patterns across your ${selectedCount} selected role${selectedCount > 1 ? 's' : ''} and create a unified growth roadmap.`
                  : 'Select some roles below to enable coaching plan generation.'}
              </p>
              <Button
                onClick={handleGeneratePlan}
                disabled={generating || selectedCount === 0}
                variant="outline"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Plan from {selectedCount} Role{selectedCount !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Aspirational Roles Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Saved Aspirational Roles</h2>
            <p className="text-sm text-muted-foreground">
              {selectedCount} of {goals.length} role{goals.length !== 1 ? 's' : ''} selected for coaching (max 10)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={selectedCount >= 10 || selectedCount === goals.length}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              disabled={selectedCount === 0}
            >
              <Square className="h-3.5 w-3.5" />
              Deselect All
            </Button>
          </div>
        </div>

        {selectionError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {selectionError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {goals.map((goal: any) => (
            <AspirationalJobCard
              key={goal.id}
              goal={goal}
              onRequestDelete={setDeletingId}
              onToggleSelected={handleToggleSelected}
            />
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/jobs">
              <Plane className="h-3.5 w-3.5" />
              Browse More Jobs
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
