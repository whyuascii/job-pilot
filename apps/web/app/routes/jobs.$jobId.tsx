import React from 'react';
import {
  createFileRoute,
  Link,
  useRouter,
  useNavigate,
} from '@tanstack/react-router';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  Trash2,
  Zap,
  Target,
  BarChart3,
  Globe,
  DollarSign,
  Briefcase,
  Clock,
  RefreshCw,
  Wand2,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  XCircle,
  Star,
  Puzzle,
  Printer,
  GitCompareArrows,
  Plus,
  Loader2,
  Bookmark,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@job-pilot/ui';
import { ScoreIndicator } from '@job-pilot/ui';
import { api } from '~/lib/api-client';

interface SkillGapAnalysis {
  matchedMustHave: Array<{ jobSkill: string; candidateSkill: string; confidenceScore: number }>;
  missingMustHave: string[];
  matchedNiceToHave: Array<{ jobSkill: string; candidateSkill: string; confidenceScore: number }>;
  missingNiceToHave: string[];
  extraSkills: Array<{ name: string; category: string; confidenceScore: number }>;
  mustHaveMatchPercentage: number;
  niceToHaveMatchPercentage: number;
  overallMatchPercentage: number;
  recommendation: string;
}
import {
  ResumeComparisonView,
  type OriginalProfile,
  type TailoredResumeContent as ComparisonTailoredContent,
} from '~/components/resume-comparison';
import { ApplicationAssistDrawer } from '~/components/application-assist-drawer';

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute('/jobs/$jobId')({
  loader: async ({ params }) => {
    const [job, tailored, rawSkillGap, originalProfile, isCareerGoal, coverLetter, candidate] = await Promise.all([
      api.jobs.get(params.jobId),
      api.ai.getTailoredResume(params.jobId).catch(() => null),
      api.skillGap.get(params.jobId).catch(() => null),
      api.ai.getOriginalProfile().catch(() => null),
      api.careerGoals.list().then(
        (goals) => goals.some((g: any) => g.jobId === params.jobId),
      ).catch(() => false),
      api.coverLetter.get(params.jobId).catch(() => null),
      api.candidates.get().catch(() => null),
    ]);

    // Transform the skill-gap API response to match the SkillGapAnalysis shape
    // The API returns: { mustHave: { matched, missing, score }, niceToHave: { matched, missing, score }, overallScore, candidateSkills }
    // The component expects: { matchedMustHave, missingMustHave, matchedNiceToHave, missingNiceToHave, extraSkills, mustHaveMatchPercentage, niceToHaveMatchPercentage, overallMatchPercentage, recommendation }
    let skillGap: SkillGapAnalysis | null = null;
    if (rawSkillGap) {
      const mustHaveMatched: string[] = rawSkillGap.mustHave?.matched ?? [];
      const mustHaveMissing: string[] = rawSkillGap.mustHave?.missing ?? [];
      const niceToHaveMatched: string[] = rawSkillGap.niceToHave?.matched ?? [];
      const niceToHaveMissing: string[] = rawSkillGap.niceToHave?.missing ?? [];
      const candidateSkills: string[] = rawSkillGap.candidateSkills ?? [];

      // If the response already has the component's expected shape (e.g. from a
      // different API version), use it directly.
      if (Array.isArray(rawSkillGap.matchedMustHave)) {
        skillGap = {
          matchedMustHave: rawSkillGap.matchedMustHave ?? [],
          missingMustHave: rawSkillGap.missingMustHave ?? [],
          matchedNiceToHave: rawSkillGap.matchedNiceToHave ?? [],
          missingNiceToHave: rawSkillGap.missingNiceToHave ?? [],
          extraSkills: rawSkillGap.extraSkills ?? [],
          mustHaveMatchPercentage: rawSkillGap.mustHaveMatchPercentage ?? 0,
          niceToHaveMatchPercentage: rawSkillGap.niceToHaveMatchPercentage ?? 0,
          overallMatchPercentage: rawSkillGap.overallMatchPercentage ?? 0,
          recommendation: rawSkillGap.recommendation ?? '',
        };
      } else {
        // Build the list of required skill names for filtering extra skills
        const allRequiredLower = new Set(
          [...mustHaveMatched, ...mustHaveMissing, ...niceToHaveMatched, ...niceToHaveMissing]
            .map((s) => s.toLowerCase()),
        );

        skillGap = {
          matchedMustHave: mustHaveMatched.map((s) => ({
            jobSkill: s,
            candidateSkill: s,
            confidenceScore: 100,
          })),
          missingMustHave: mustHaveMissing,
          matchedNiceToHave: niceToHaveMatched.map((s) => ({
            jobSkill: s,
            candidateSkill: s,
            confidenceScore: 100,
          })),
          missingNiceToHave: niceToHaveMissing,
          extraSkills: candidateSkills
            .filter((s) => !allRequiredLower.has(s.toLowerCase()))
            .map((s) => ({ name: s, category: 'other', confidenceScore: 0 })),
          mustHaveMatchPercentage: rawSkillGap.mustHave?.score ?? 0,
          niceToHaveMatchPercentage: rawSkillGap.niceToHave?.score ?? 0,
          overallMatchPercentage: rawSkillGap.overallScore ?? 0,
          recommendation: '',
        };
      }
    }

    return { job, tailored, skillGap, originalProfile, isCareerGoal, coverLetter, candidate };
  },
  component: JobDetailPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LoaderData = Awaited<ReturnType<typeof Route['options']['loader']>>;

interface FitBreakdown {
  titleMatch: number;
  compensationFit: number;
  locationFit: number;
  stackOverlap: number;
  seniorityFit: number;
  industryFit: number;
}

interface CompetitivenessBreakdown {
  requiredSkillsOverlap: number;
  experienceDepth: number;
  domainRelevance: number;
  leadershipMatch: number;
  adjacentSkills: number;
  gapPenalty: number;
}

interface TailoredResumeContent {
  summary: string;
  highlightedSkills: string[];
  experienceBlocks: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    bullets: string[];
    relevanceScore: number;
  }>;
  projectHighlights: Array<{
    name: string;
    description: string;
    skills: string[];
    highlights: string[];
  }>;
  gapAnalysis: {
    missingSkills: string[];
    recommendations: string[];
  };
  overallConfidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-blue-600';
  if (score >= 25) return 'text-amber-900';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 50) return 'bg-blue-500';
  if (score >= 25) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreTrackColor(score: number): string {
  if (score >= 75) return 'bg-emerald-100/50';
  if (score >= 50) return 'bg-blue-100/50';
  if (score >= 25) return 'bg-amber-100/50';
  return 'bg-red-100/50';
}

function getRecommendationStyle(rec: string | null): {
  variant: 'success' | 'default' | 'warning' | 'destructive';
  label: string;
} {
  switch (rec) {
    case 'strong_apply':
      return { variant: 'success', label: 'Strong Apply' };
    case 'apply':
      return { variant: 'default', label: 'Apply' };
    case 'maybe':
      return { variant: 'warning', label: 'Maybe' };
    case 'skip':
      return { variant: 'destructive', label: 'Skip' };
    default:
      return { variant: 'secondary' as any, label: rec ?? 'Unknown' };
  }
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

function getConfidenceBadge(confidence: string): {
  variant: 'success' | 'default' | 'warning';
  label: string;
} {
  switch (confidence) {
    case 'high':
      return { variant: 'success', label: 'High Confidence' };
    case 'medium':
      return { variant: 'default', label: 'Medium Confidence' };
    case 'low':
      return { variant: 'warning', label: 'Low Confidence' };
    default:
      return { variant: 'default', label: confidence };
  }
}

function getRelevanceColor(score: number): string {
  if (score >= 75) return 'text-emerald-700 bg-white border-emerald-300';
  if (score >= 50) return 'text-blue-700 bg-white border-blue-300';
  if (score >= 25) return 'text-amber-700 bg-white border-amber-300';
  return 'text-red-700 bg-white border-red-300';
}

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
    min && max
      ? `${fmt(min)} - ${fmt(max)}`
      : min
        ? `${fmt(min)}+`
        : `Up to ${fmt(max!)}`;
  const suffix =
    type === 'hourly' ? '/hr' : type === 'contract' ? '/contract' : '/yr';
  return range + suffix;
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(date: string | null | undefined): string {
  if (!date) return 'Present';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

function formatMonthYear(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

function camelToTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreProgressBar({
  label,
  score,
  maxScore = 100,
}: {
  label: string;
  score: number;
  maxScore?: number;
}) {
  const pct = Math.min(Math.max((score / maxScore) * 100, 0), 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${getScoreColor(score)}`}>
          {Math.round(score)}
        </span>
      </div>
      <div
        className={`h-2 w-full rounded-full ${getScoreTrackColor(score)}`}
      >
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getScoreBgColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TailoredResumePreview({
  content,
  createdAt,
  version,
}: {
  content: TailoredResumeContent;
  createdAt: string | Date;
  version: number;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const confidenceStyle = getConfidenceBadge(content.overallConfidence);

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-500" />
          <h2 className="text-xl font-semibold">Tailored Resume</h2>
          <Badge variant={confidenceStyle.variant} className="text-xs">
            {confidenceStyle.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            v{version} - {formatMonthYear(createdAt)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4">
          {/* Tailored Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tailored Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{content.summary}</p>
            </CardContent>
          </Card>

          {/* Highlighted Skills */}
          {(content.highlightedSkills ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Skills to Highlight</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(content.highlightedSkills ?? []).map((skill, idx) => (
                    <Badge
                      key={skill}
                      variant={idx < 5 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {idx < 5 && (
                        <span className="mr-1 text-[10px] font-bold opacity-60">
                          #{idx + 1}
                        </span>
                      )}
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tailored Experience */}
          {(content.experienceBlocks ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Tailored Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {(content.experienceBlocks ?? []).map((block, idx) => (
                  <div
                    key={`${block.company}-${block.title}-${idx}`}
                    className="space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{block.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {block.company}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(block.startDate)} -{' '}
                          {formatShortDate(block.endDate)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${getRelevanceColor(block.relevanceScore)}`}
                      >
                        {block.relevanceScore}% relevant
                      </span>
                    </div>
                    {(block.bullets ?? []).length > 0 && (
                      <ul className="space-y-1 pl-4">
                        {(block.bullets ?? []).map((bullet, bIdx) => (
                          <li
                            key={bIdx}
                            className="text-sm text-muted-foreground list-disc"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                    {idx < (content.experienceBlocks ?? []).length - 1 && (
                      <Separator className="mt-3" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Project Highlights */}
          {(content.projectHighlights ?? []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Projects to Feature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(content.projectHighlights ?? []).map((project, idx) => (
                  <div key={`${project.name}-${idx}`} className="space-y-2">
                    <p className="font-semibold text-sm">{project.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {project.description}
                    </p>
                    {(project.skills ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(project.skills ?? []).map((skill) => (
                          <Badge
                            key={skill}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {(project.highlights ?? []).length > 0 && (
                      <ul className="space-y-1 pl-4">
                        {(project.highlights ?? []).map((h, hIdx) => (
                          <li
                            key={hIdx}
                            className="text-sm text-muted-foreground list-disc"
                          >
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                    {idx < (content.projectHighlights ?? []).length - 1 && (
                      <Separator className="mt-2" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Gap Analysis */}
          {content.gapAnalysis && (
            ((content.gapAnalysis.missingSkills ?? []).length > 0 ||
              (content.gapAnalysis.recommendations ?? []).length > 0) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Gap Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(content.gapAnalysis.missingSkills ?? []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Missing Skills
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(content.gapAnalysis.missingSkills ?? []).map((skill) => (
                          <Badge
                            key={skill}
                            variant="destructive"
                            className="text-xs"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(content.gapAnalysis.recommendations ?? []).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Recommendations
                      </p>
                      <ul className="space-y-1.5">
                        {(content.gapAnalysis.recommendations ?? []).map(
                          (rec, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Lightbulb className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                              <span>{rec}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skill Gap Analysis sub-component
// ---------------------------------------------------------------------------

function SkillGapMatchBar({
  label,
  percentage,
}: {
  label: string;
  percentage: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${getScoreColor(percentage)}`}>
          {percentage}%
        </span>
      </div>
      <div className={`h-2.5 w-full rounded-full ${getScoreTrackColor(percentage)}`}>
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${getScoreBgColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SkillGapSection({ analysis, onAddSkill, addingSkills, addedSkills }: {
  analysis: SkillGapAnalysis;
  onAddSkill?: (skill: string) => void;
  addingSkills?: Set<string>;
  addedSkills?: Set<string>;
}) {
  const [expanded, setExpanded] = React.useState(true);

  const matchedMustHave = analysis.matchedMustHave ?? [];
  const missingMustHave = analysis.missingMustHave ?? [];
  const matchedNiceToHave = analysis.matchedNiceToHave ?? [];
  const missingNiceToHave = analysis.missingNiceToHave ?? [];
  const extraSkills = analysis.extraSkills ?? [];

  const hasSkillData =
    matchedMustHave.length > 0 ||
    missingMustHave.length > 0 ||
    matchedNiceToHave.length > 0 ||
    missingNiceToHave.length > 0;

  if (!hasSkillData && extraSkills.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-violet-500" />
          <h2 className="text-xl font-semibold">Skill Gap Analysis</h2>
          <Badge
            variant={
              (analysis.overallMatchPercentage ?? 0) >= 75
                ? 'success'
                : (analysis.overallMatchPercentage ?? 0) >= 50
                  ? 'default'
                  : (analysis.overallMatchPercentage ?? 0) >= 25
                    ? 'warning'
                    : 'destructive'
            }
            className="text-xs"
          >
            {analysis.overallMatchPercentage ?? 0}% match
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Progress bars for match percentages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Match Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SkillGapMatchBar
                label="Must-Have Skills"
                percentage={analysis.mustHaveMatchPercentage ?? 0}
              />
              <SkillGapMatchBar
                label="Nice-to-Have Skills"
                percentage={analysis.niceToHaveMatchPercentage ?? 0}
              />
              <Separator />
              <SkillGapMatchBar
                label="Overall Weighted Match"
                percentage={analysis.overallMatchPercentage ?? 0}
              />
            </CardContent>
          </Card>

          {/* Must-have skills detail */}
          {(matchedMustHave.length > 0 || missingMustHave.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-red-500" />
                  Must-Have Skills
                  <span className="text-sm font-normal text-muted-foreground">
                    ({matchedMustHave.length}/{matchedMustHave.length + missingMustHave.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Matched must-have */}
                {matchedMustHave.length > 0 && (
                  <div className="space-y-2">
                    {matchedMustHave.map((skill) => (
                      <div
                        key={skill.jobSkill}
                        className="flex items-center justify-between rounded-md border border-emerald-300 bg-white px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-sm font-medium text-emerald-800">
                            {skill.jobSkill}
                          </span>
                          {skill.candidateSkill.toLowerCase() !== skill.jobSkill.toLowerCase() && (
                            <span className="text-xs text-emerald-600">
                              (matched: {skill.candidateSkill})
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                          {Math.round(skill.confidenceScore)}% confidence
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Missing must-have */}
                {missingMustHave.length > 0 && (
                  <div className="space-y-2">
                    {missingMustHave.map((skill) => {
                      const isAdding = addingSkills?.has(skill);
                      const isAdded = addedSkills?.has(skill);
                      return (
                        <div
                          key={skill}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                            isAdded ? 'border-emerald-300 bg-white' : 'border-red-200 bg-red-50'
                          }`}
                        >
                          {isAdded ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className={`text-sm font-medium ${isAdded ? 'text-emerald-800' : 'text-red-800'}`}>
                            {skill}
                          </span>
                          {isAdded ? (
                            <span className="text-xs text-emerald-600 ml-auto">Added to profile</span>
                          ) : (
                            <>
                              <span className="text-xs text-red-500 ml-auto mr-2">Missing</span>
                              {onAddSkill && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-sky-700 hover:text-sky-900 hover:bg-sky-50"
                                  onClick={() => onAddSkill(skill)}
                                  disabled={isAdding}
                                >
                                  {isAdding ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      Add
                                    </>
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Nice-to-have skills detail */}
          {(matchedNiceToHave.length > 0 || missingNiceToHave.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-amber-500" />
                  Nice-to-Have Skills
                  <span className="text-sm font-normal text-muted-foreground">
                    ({matchedNiceToHave.length}/{matchedNiceToHave.length + missingNiceToHave.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Matched nice-to-have */}
                {matchedNiceToHave.length > 0 && (
                  <div className="space-y-2">
                    {matchedNiceToHave.map((skill) => (
                      <div
                        key={skill.jobSkill}
                        className="flex items-center justify-between rounded-md border border-emerald-300 bg-white px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span className="text-sm font-medium text-emerald-800">
                            {skill.jobSkill}
                          </span>
                          {skill.candidateSkill.toLowerCase() !== skill.jobSkill.toLowerCase() && (
                            <span className="text-xs text-emerald-600">
                              (matched: {skill.candidateSkill})
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                          {Math.round(skill.confidenceScore)}% confidence
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Missing nice-to-have */}
                {missingNiceToHave.length > 0 && (
                  <div className="space-y-2">
                    {missingNiceToHave.map((skill) => {
                      const isAdding = addingSkills?.has(skill);
                      const isAdded = addedSkills?.has(skill);
                      return (
                        <div
                          key={skill}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                            isAdded ? 'border-emerald-300 bg-white' : 'border-red-300 bg-white'
                          }`}
                        >
                          {isAdded ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                          <span className={`text-sm font-medium ${isAdded ? 'text-emerald-800' : 'text-foreground'}`}>
                            {skill}
                          </span>
                          {isAdded ? (
                            <span className="text-xs text-emerald-600 ml-auto">Added to profile</span>
                          ) : (
                            <>
                              <span className="text-xs text-red-500 ml-auto mr-2">Missing</span>
                              {onAddSkill && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs text-sky-700 hover:text-sky-900 hover:bg-sky-50"
                                  onClick={() => onAddSkill(skill)}
                                  disabled={isAdding}
                                >
                                  {isAdding ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-0.5" />
                                      Add
                                    </>
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Extra / Bonus Skills */}
          {extraSkills.length > 0 && (
            <div className="lg:col-span-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4 text-blue-500" />
                    Bonus Skills
                    <span className="text-sm font-normal text-muted-foreground">
                      ({extraSkills.length} additional)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {extraSkills.map((skill) => (
                      <Badge
                        key={skill.name}
                        variant="outline"
                        className="text-xs"
                      >
                        {skill.name}
                        {skill.confidenceScore > 0 && (
                          <span className="ml-1 opacity-60">
                            {Math.round(skill.confidenceScore)}%
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recommendation */}
          {analysis.recommendation && (
            <div className="lg:col-span-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {analysis.recommendation}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function JobDetailPage() {
  const {
    job,
    tailored: initialTailored,
    skillGap,
    originalProfile,
    isCareerGoal,
    coverLetter: initialCoverLetter,
    candidate,
  } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [scoring, setScoring] = React.useState(false);
  const [creatingApp, setCreatingApp] = React.useState(false);
  const [tailoring, setTailoring] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [tailoredData, setTailoredData] = React.useState<{
    content: TailoredResumeContent;
    createdAt: string | Date;
    version: number;
  } | null>(
    initialTailored
      ? {
          content: initialTailored.content as TailoredResumeContent,
          createdAt: initialTailored.createdAt,
          version: initialTailored.version,
        }
      : null,
  );
  const [addingSkills, setAddingSkills] = React.useState<Set<string>>(new Set());
  const [addedSkills, setAddedSkills] = React.useState<Set<string>>(new Set());
  const [savingGoal, setSavingGoal] = React.useState(false);
  const [savedGoal, setSavedGoal] = React.useState(isCareerGoal);
  const [assistDrawerOpen, setAssistDrawerOpen] = React.useState(false);
  const [coverLetterData, setCoverLetterData] = React.useState<{ content: string; contentHtml?: string } | null>(initialCoverLetter);

  async function handleSaveCareerGoal() {
    setSavingGoal(true);
    try {
      await api.careerGoals.save({ jobId: job.id });
      setSavedGoal(true);
    } catch (err) {
      console.error('Failed to save career goal:', err);
    } finally {
      setSavingGoal(false);
    }
  }

  async function handleAddSkillToProfile(skillName: string) {
    if (addingSkills.has(skillName) || addedSkills.has(skillName)) return;
    setAddingSkills((prev) => new Set(prev).add(skillName));
    try {
      await api.skills.add({ name: skillName, category: 'technical', confidenceScore: 50 });
      setAddedSkills((prev) => new Set(prev).add(skillName));
    } catch (err) {
      console.error('Failed to add skill:', err);
    } finally {
      setAddingSkills((prev) => {
        const next = new Set(prev);
        next.delete(skillName);
        return next;
      });
    }
  }

  const comp = formatCompensation(
    job.compensationMin,
    job.compensationMax,
    job.compensationCurrency,
    job.compensationType ?? 'annual',
  );

  const fitBreakdown = job.score?.fitBreakdown as FitBreakdown | null;
  const competitivenessBreakdown = job.score
    ?.competitivenessBreakdown as CompetitivenessBreakdown | null;

  // Handlers
  async function handleDelete() {
    setDeleting(true);
    try {
      await api.jobs.delete({ jobId: job.id });
      navigate({ to: '/jobs' });
    } catch (err) {
      console.error('Failed to delete job:', err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleScore() {
    setScoring(true);
    try {
      await api.ai.scoreJob({ jobId: job.id });
      router.invalidate();
    } catch (err) {
      console.error('Failed to score job:', err);
    } finally {
      setScoring(false);
    }
  }

  async function handleStartApplication() {
    setCreatingApp(true);
    try {
      await api.applications.create({ jobId: job.id });
      navigate({ to: '/applications' });
    } catch (err) {
      console.error('Failed to create application:', err);
    } finally {
      setCreatingApp(false);
    }
  }

  async function handleTailorResume() {
    setTailoring(true);
    try {
      const result = await api.ai.tailorResume({ jobId: job.id });
      setTailoredData({
        content: result.content as TailoredResumeContent,
        createdAt: result.createdAt,
        version: result.version,
      });
    } catch (err) {
      console.error('Failed to tailor resume:', err);
    } finally {
      setTailoring(false);
    }
  }

  async function handleExportResume() {
    setExporting(true);
    try {
      const result = await api.resumeRenderer.export({ jobId: job.id });
      // Open the HTML in a new window for print-to-PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(result.html);
        printWindow.document.close();
      }
    } catch (err) {
      console.error('Failed to export resume:', err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ----------------------------------------------------------------- */}
      {/* Header Section                                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        {/* Back button */}
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>

        {/* Title & meta */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>

            {/* Company */}
            <div className="flex items-center gap-2 text-lg text-muted-foreground">
              <Building2 className="h-5 w-5 shrink-0" />
              <span>{job.company}</span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {/* Location + remote policy */}
              {job.location && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {job.location}
                </span>
              )}
              {job.remotePolicy && (
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getRemotePolicyColor(job.remotePolicy)}`}
                >
                  <Globe className="h-3 w-3" />
                  {job.remotePolicy.charAt(0).toUpperCase() +
                    job.remotePolicy.slice(1)}
                </span>
              )}

              {/* Compensation */}
              {comp && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="h-4 w-4 shrink-0" />
                  {comp}
                </span>
              )}

              {/* Employment type */}
              {job.employmentType && (
                <Badge variant="secondary" className="text-xs">
                  <Briefcase className="h-3 w-3 mr-1" />
                  {job.employmentType.charAt(0).toUpperCase() +
                    job.employmentType.slice(1)}
                </Badge>
              )}

              {/* Posted date */}
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                {formatDate(job.createdAt)}
              </span>
            </div>
          </div>

        </div>
      </div>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Score Section                                                      */}
      {/* ----------------------------------------------------------------- */}
      {job.score ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Score Breakdown</h2>
          </div>

          {/* Overall score + recommendation */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
            {/* Large score circle */}
            {job.score.overallScore != null && (
              <ScoreIndicator
                score={job.score.overallScore}
                label="Overall Score"
                size="lg"
              />
            )}

            {/* Recommendation + reasoning */}
            <div className="flex-1 space-y-3">
              {job.score.recommendation && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground mr-2">
                    Recommendation:
                  </span>
                  <Badge
                    variant={
                      getRecommendationStyle(job.score.recommendation).variant
                    }
                  >
                    {getRecommendationStyle(job.score.recommendation).label}
                  </Badge>
                </div>
              )}

              {job.score.reasoning && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    AI Reasoning:
                  </p>
                  <p className="text-sm leading-relaxed">
                    {job.score.reasoning as string}
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleScore}
                disabled={scoring}
              >
                <RefreshCw
                  className={`h-4 w-4 ${scoring ? 'animate-spin' : ''}`}
                />
                {scoring ? 'Rescoring...' : 'Rescore'}
              </Button>
            </div>
          </div>

          {/* Breakdown grids */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Fit Score breakdown */}
            {fitBreakdown && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-blue-500" />
                    Fit Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScoreProgressBar
                    label="Title Match"
                    score={fitBreakdown.titleMatch}
                  />
                  <ScoreProgressBar
                    label="Compensation Fit"
                    score={fitBreakdown.compensationFit}
                  />
                  <ScoreProgressBar
                    label="Location Fit"
                    score={fitBreakdown.locationFit}
                  />
                  <ScoreProgressBar
                    label="Stack Overlap"
                    score={fitBreakdown.stackOverlap}
                  />
                  <ScoreProgressBar
                    label="Seniority Fit"
                    score={fitBreakdown.seniorityFit}
                  />
                  <ScoreProgressBar
                    label="Industry Fit"
                    score={fitBreakdown.industryFit}
                  />
                </CardContent>
              </Card>
            )}

            {/* Competitiveness breakdown */}
            {competitivenessBreakdown && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    Competitiveness
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScoreProgressBar
                    label="Required Skills Overlap"
                    score={competitivenessBreakdown.requiredSkillsOverlap}
                  />
                  <ScoreProgressBar
                    label="Experience Depth"
                    score={competitivenessBreakdown.experienceDepth}
                  />
                  <ScoreProgressBar
                    label="Domain Relevance"
                    score={competitivenessBreakdown.domainRelevance}
                  />
                  <ScoreProgressBar
                    label="Leadership Match"
                    score={competitivenessBreakdown.leadershipMatch}
                  />
                  <ScoreProgressBar
                    label="Adjacent Skills"
                    score={competitivenessBreakdown.adjacentSkills}
                  />
                  <ScoreProgressBar
                    label="Gap Penalty"
                    score={competitivenessBreakdown.gapPenalty}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* No score yet */
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <Zap className="h-10 w-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="font-semibold">No score yet</p>
              <p className="text-sm text-muted-foreground">
                Run the AI scorer to see how well this job matches your profile.
              </p>
            </div>
            <Button onClick={handleScore} disabled={scoring}>
              <Zap className="h-4 w-4" />
              {scoring ? 'Scoring...' : 'Score this Job'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Job Description Section                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Job Description</h2>

        <Card>
          <CardContent className="pt-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {(job.parsedDescription as string) || job.rawDescription || (
                <p className="text-muted-foreground italic">
                  No description available.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* ----------------------------------------------------------------- */}
      {/* Skill Gap Analysis Section                                         */}
      {/* ----------------------------------------------------------------- */}
      {skillGap && <SkillGapSection analysis={skillGap} onAddSkill={handleAddSkillToProfile} addingSkills={addingSkills} addedSkills={addedSkills} />}

      {skillGap && <Separator />}

      {/* ----------------------------------------------------------------- */}
      {/* Tailored Resume Section                                            */}
      {/* ----------------------------------------------------------------- */}
      {tailoredData ? (
        <div className="space-y-4">
          <Tabs defaultValue="tailored">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="tailored">
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Tailored Resume
                </TabsTrigger>
                <TabsTrigger
                  value="compare"
                  disabled={!originalProfile}
                >
                  <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
                  Compare
                </TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTailorResume}
                  disabled={tailoring}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${tailoring ? 'animate-spin' : ''}`}
                  />
                  {tailoring ? 'Tailoring flight manual...' : 'Re-tailor Resume'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportResume}
                  disabled={exporting}
                >
                  <Printer className="h-4 w-4" />
                  {exporting ? 'Preparing...' : 'Export / Print'}
                </Button>
              </div>
            </div>

            <TabsContent value="tailored">
              <TailoredResumePreview
                content={tailoredData.content}
                createdAt={tailoredData.createdAt}
                version={tailoredData.version}
              />
            </TabsContent>

            <TabsContent value="compare">
              {originalProfile ? (
                <ResumeComparisonView
                  original={originalProfile as OriginalProfile}
                  tailored={tailoredData.content as ComparisonTailoredContent}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center gap-4 py-10">
                    <GitCompareArrows className="h-10 w-10 text-muted-foreground/30" />
                    <div className="text-center">
                      <p className="font-semibold">No profile data available</p>
                      <p className="text-sm text-muted-foreground">
                        Create a candidate profile to compare original vs. tailored
                        resume content.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <Wand2 className="h-10 w-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="font-semibold">Tailor your resume</p>
              <p className="text-sm text-muted-foreground">
                Use AI to customize your resume for this specific role,
                highlighting the most relevant skills and experience.
              </p>
            </div>
            <Button onClick={handleTailorResume} disabled={tailoring}>
              <Wand2
                className={`h-4 w-4 ${tailoring ? 'animate-pulse' : ''}`}
              />
              {tailoring ? 'Tailoring flight manual...' : 'Tailor Resume'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Cover Letter Section                                               */}
      {/* ----------------------------------------------------------------- */}
      {coverLetterData && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-500" />
              <h2 className="text-xl font-semibold">Cover Letter</h2>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {coverLetterData.content}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Floating Action Bar                                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="fixed bottom-0 right-0 left-0 md:left-64 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
          {/* Apply with Assist */}
          <Button
            onClick={() => {
              const applyUrl = job.applyUrl || job.sourceUrl;
              if (applyUrl) window.open(applyUrl, '_blank', 'noopener,noreferrer');
              setAssistDrawerOpen(true);
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Zap className="h-4 w-4" />
            Apply with Assist
          </Button>

          {/* Apply (external) */}
          {(job.applyUrl || job.sourceUrl) && (
            <Button variant="outline" asChild>
              <a
                href={job.applyUrl || job.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Apply
              </a>
            </Button>
          )}

          {/* Tailor / Re-tailor Resume */}
          <Button
            variant="outline"
            onClick={handleTailorResume}
            disabled={tailoring}
          >
            <Wand2 className={`h-4 w-4 ${tailoring ? 'animate-pulse' : ''}`} />
            {tailoring ? 'Tailoring...' : tailoredData ? 'Re-tailor' : 'Tailor Resume'}
          </Button>

          {/* Save as Career Goal */}
          <Button
            variant="outline"
            onClick={handleSaveCareerGoal}
            disabled={savingGoal || savedGoal}
          >
            {savedGoal ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Saved as Goal
              </>
            ) : (
              <>
                <Bookmark className={`h-4 w-4 ${savingGoal ? 'animate-pulse' : ''}`} />
                {savingGoal ? 'Saving...' : 'Save as Career Goal'}
              </>
            )}
          </Button>

          {/* Export Resume */}
          {tailoredData && (
            <Button
              variant="outline"
              onClick={handleExportResume}
              disabled={exporting}
            >
              <Printer className="h-4 w-4" />
              {exporting ? 'Preparing...' : 'Export Resume'}
            </Button>
          )}

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete job"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Application Assist Drawer */}
      <ApplicationAssistDrawer
        open={assistDrawerOpen}
        onOpenChange={setAssistDrawerOpen}
        job={job}
        candidate={candidate}
        existingTailored={tailoredData ? { content: tailoredData.content, createdAt: tailoredData.createdAt, version: tailoredData.version } : null}
        existingCoverLetter={coverLetterData}
        onMarkApplied={() => {
          router.invalidate();
        }}
      />
    </div>
  );
}
