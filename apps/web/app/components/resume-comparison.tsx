import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Minus,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Separator,
} from '@job-pilot/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OriginalSkill {
  name: string;
  category: string;
  confidenceScore: number;
  yearsUsed: number | null;
}

interface OriginalExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  current: boolean;
  description: string;
  bullets: string[];
  skills: string[];
}

interface OriginalProject {
  name: string;
  description: string;
  url: string | null;
  skills: string[];
  highlights: string[];
}

export interface OriginalProfile {
  summary: string;
  headline: string;
  currentTitle: string;
  currentCompany: string | null;
  yearsOfExperience: number;
  skills: OriginalSkill[];
  experience: OriginalExperience[];
  projects: OriginalProject[];
}

interface TailoredExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  bullets: string[];
  relevanceScore: number;
}

interface TailoredProject {
  name: string;
  description: string;
  skills: string[];
  highlights: string[];
}

export interface TailoredResumeContent {
  summary: string;
  highlightedSkills: string[];
  experienceBlocks: TailoredExperience[];
  projectHighlights: TailoredProject[];
  gapAnalysis: {
    missingSkills: string[];
    recommendations: string[];
  };
  overallConfidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(date: string | null | undefined): string {
  if (!date) return 'Present';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

/** Identify skills that appear in the tailored list but NOT in original. */
function classifySkills(
  original: OriginalSkill[],
  tailored: string[],
): {
  emphasized: string[];
  deEmphasized: string[];
  unchanged: string[];
} {
  const originalNames = new Set(
    original.map((s) => s.name.toLowerCase()),
  );
  const tailoredNames = new Set(
    tailored.map((s) => s.toLowerCase()),
  );

  const emphasized: string[] = [];
  const unchanged: string[] = [];

  for (const skill of tailored) {
    if (originalNames.has(skill.toLowerCase())) {
      unchanged.push(skill);
    } else {
      emphasized.push(skill);
    }
  }

  const deEmphasized: string[] = [];
  for (const skill of original) {
    if (!tailoredNames.has(skill.name.toLowerCase())) {
      deEmphasized.push(skill.name);
    }
  }

  return { emphasized, deEmphasized, unchanged };
}

// ---------------------------------------------------------------------------
// Collapsible Section wrapper
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon,
  defaultExpanded = true,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-semibold">{title}</h3>
          {badge}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary comparison
// ---------------------------------------------------------------------------

function SummaryComparison({
  original,
  tailored,
}: {
  original: string;
  tailored: string;
}) {
  return (
    <CollapsibleSection
      title="Professional Summary"
      icon={<FileText className="h-4 w-4 text-sky-500" />}
      badge={
        original !== tailored ? (
          <Badge variant="default" className="text-[10px] bg-sky-600">
            Rewritten
          </Badge>
        ) : null
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Original */}
        <Card className="border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Original
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">
              {original || (
                <span className="italic text-muted-foreground">
                  No summary on file
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Tailored */}
        <Card className="border-sky-300 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sky-700 font-medium">
              Tailored
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{tailored}</p>
          </CardContent>
        </Card>
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Skills comparison
// ---------------------------------------------------------------------------

function SkillsComparison({
  original,
  tailored,
}: {
  original: OriginalSkill[];
  tailored: string[];
}) {
  const { emphasized, deEmphasized, unchanged } = classifySkills(
    original,
    tailored,
  );

  const totalChanges = emphasized.length + deEmphasized.length;

  return (
    <CollapsibleSection
      title="Skills"
      icon={<FileText className="h-4 w-4 text-violet-500" />}
      badge={
        totalChanges > 0 ? (
          <Badge variant="default" className="text-[10px] bg-violet-600">
            {totalChanges} change{totalChanges !== 1 ? 's' : ''}
          </Badge>
        ) : null
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* Original */}
        <Card className="border-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Original ({original.length} skills)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {original.map((skill) => {
                const isKept = tailored.some(
                  (t) => t.toLowerCase() === skill.name.toLowerCase(),
                );
                return (
                  <Badge
                    key={skill.name}
                    variant="secondary"
                    className={`text-xs ${
                      !isKept
                        ? 'opacity-40 line-through'
                        : ''
                    }`}
                  >
                    {skill.name}
                  </Badge>
                );
              })}
              {original.length === 0 && (
                <span className="text-sm italic text-muted-foreground">
                  No skills on file
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tailored */}
        <Card className="border-sky-300 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sky-700 font-medium">
              Tailored ({tailored.length} highlighted)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {tailored.map((skill, idx) => {
                const isNew = !original.some(
                  (o) => o.name.toLowerCase() === skill.toLowerCase(),
                );
                return (
                  <Badge
                    key={skill}
                    variant={idx < 5 ? 'default' : 'secondary'}
                    className={`text-xs ${
                      isNew
                        ? 'ring-2 ring-emerald-400 ring-offset-1'
                        : ''
                    }`}
                  >
                    {isNew && (
                      <Plus className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    {skill}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      {totalChanges > 0 && (
        <div className="flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
          {emphasized.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
              {emphasized.length} newly emphasized
            </span>
          )}
          {deEmphasized.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              {deEmphasized.length} de-emphasized
            </span>
          )}
          {unchanged.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
              {unchanged.length} carried over
            </span>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Experience comparison
// ---------------------------------------------------------------------------

function ExperienceComparison({
  original,
  tailored,
}: {
  original: OriginalExperience[];
  tailored: TailoredExperience[];
}) {
  // Match tailored blocks to original by company+title
  const matchedPairs: Array<{
    original: OriginalExperience | null;
    tailored: TailoredExperience;
  }> = tailored.map((t) => {
    const match = original.find(
      (o) =>
        o.company.toLowerCase() === t.company.toLowerCase() &&
        o.title.toLowerCase() === t.title.toLowerCase(),
    );
    return { original: match ?? null, tailored: t };
  });

  // Find original entries that were excluded from tailored
  const excludedOriginals = original.filter(
    (o) =>
      !tailored.some(
        (t) =>
          t.company.toLowerCase() === o.company.toLowerCase() &&
          t.title.toLowerCase() === o.title.toLowerCase(),
      ),
  );

  return (
    <CollapsibleSection
      title="Experience"
      icon={<FileText className="h-4 w-4 text-amber-500" />}
      badge={
        <Badge variant="default" className="text-[10px] bg-amber-600">
          {tailored.length} of {original.length} roles featured
        </Badge>
      }
    >
      <div className="space-y-4">
        {matchedPairs.map(({ original: orig, tailored: tail }, idx) => {
          const origBullets = orig?.bullets ?? [];
          const tailBullets = tail.bullets ?? [];
          const bulletsChanged =
            orig &&
            (origBullets.length !== tailBullets.length ||
              origBullets.some((b, i) => b !== tailBullets[i]));

          return (
            <div key={`${tail.company}-${tail.title}-${idx}`}>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Original side */}
                <Card className="border-muted">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {orig ? orig.title : tail.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {orig ? orig.company : tail.company}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(
                            orig ? orig.startDate : tail.startDate,
                          )}{' '}
                          -{' '}
                          {formatShortDate(
                            orig ? orig.endDate : tail.endDate,
                          )}
                        </p>
                      </div>
                      {!orig && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] opacity-50"
                        >
                          Not on file
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {orig && origBullets.length > 0 ? (
                      <ul className="space-y-1 pl-4">
                        {origBullets.map((bullet, bIdx) => (
                          <li
                            key={bIdx}
                            className="text-xs text-muted-foreground list-disc"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        {orig
                          ? orig.description || 'No bullet points'
                          : 'Original not found in profile'}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Tailored side */}
                <Card className="border-sky-300 bg-white">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {tail.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {tail.company}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatShortDate(tail.startDate)} -{' '}
                          {formatShortDate(tail.endDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {bulletsChanged && (
                          <Badge
                            variant="default"
                            className="text-[10px] bg-sky-600"
                          >
                            Reframed
                          </Badge>
                        )}
                        <span
                          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                            tail.relevanceScore >= 75
                              ? 'text-emerald-700 bg-white border-emerald-300'
                              : tail.relevanceScore >= 50
                                ? 'text-sky-700 bg-white border-sky-300'
                                : 'text-amber-700 bg-white border-amber-300'
                          }`}
                        >
                          {tail.relevanceScore}%
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {tailBullets.length > 0 ? (
                      <ul className="space-y-1 pl-4">
                        {tailBullets.map((bullet, bIdx) => (
                          <li
                            key={bIdx}
                            className="text-xs list-disc"
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic text-muted-foreground">
                        No bullets generated
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
              {idx < matchedPairs.length - 1 && <Separator className="mt-4" />}
            </div>
          );
        })}

        {/* Excluded roles */}
        {excludedOriginals.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
                <Minus className="h-3 w-3" />
                {excludedOriginals.length} role
                {excludedOriginals.length !== 1 ? 's' : ''} de-emphasized in
                tailored version
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {excludedOriginals.map((exp, idx) => (
                  <div
                    key={`excluded-${exp.company}-${idx}`}
                    className="rounded-md border border-dashed border-muted-foreground/20 px-3 py-2 opacity-50"
                  >
                    <p className="text-xs font-medium">{exp.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {exp.company} | {formatShortDate(exp.startDate)} -{' '}
                      {formatShortDate(exp.endDate)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Projects comparison
// ---------------------------------------------------------------------------

function ProjectsComparison({
  original,
  tailored,
}: {
  original: OriginalProject[];
  tailored: TailoredProject[];
}) {
  if (original.length === 0 && tailored.length === 0) {
    return null;
  }

  const matchedPairs: Array<{
    original: OriginalProject | null;
    tailored: TailoredProject;
  }> = tailored.map((t) => {
    const match = original.find(
      (o) => o.name.toLowerCase() === t.name.toLowerCase(),
    );
    return { original: match ?? null, tailored: t };
  });

  const excludedOriginals = original.filter(
    (o) =>
      !tailored.some(
        (t) => t.name.toLowerCase() === o.name.toLowerCase(),
      ),
  );

  return (
    <CollapsibleSection
      title="Projects"
      icon={<FileText className="h-4 w-4 text-emerald-500" />}
      badge={
        <Badge variant="default" className="text-[10px] bg-emerald-600">
          {tailored.length} featured
        </Badge>
      }
    >
      <div className="space-y-4">
        {matchedPairs.map(({ original: orig, tailored: tail }, idx) => (
          <div key={`${tail.name}-${idx}`}>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Original */}
              <Card className="border-muted">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {orig ? orig.name : tail.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {orig?.description || 'Not on file'}
                  </p>
                  {orig && (orig.skills ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(orig.skills ?? []).map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {orig && (orig.highlights ?? []).length > 0 && (
                    <ul className="space-y-0.5 pl-4">
                      {(orig.highlights ?? []).map((h, hIdx) => (
                        <li
                          key={hIdx}
                          className="text-xs text-muted-foreground list-disc"
                        >
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Tailored */}
              <Card className="border-sky-300 bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {tail.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs">{tail.description}</p>
                  {(tail.skills ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(tail.skills ?? []).map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {(tail.highlights ?? []).length > 0 && (
                    <ul className="space-y-0.5 pl-4">
                      {(tail.highlights ?? []).map((h, hIdx) => (
                        <li key={hIdx} className="text-xs list-disc">
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
            {idx < matchedPairs.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}

        {excludedOriginals.length > 0 && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 px-1">
              <Minus className="h-3 w-3" />
              {excludedOriginals.length} project
              {excludedOriginals.length !== 1 ? 's' : ''} not featured
            </p>
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Diff legend
// ---------------------------------------------------------------------------

function DiffLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-muted bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Legend:</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-6 rounded border border-muted bg-background" />
        Original
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-6 rounded border border-sky-200 bg-sky-50/50" />
        Tailored
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-emerald-400 ring-offset-1 bg-emerald-100" />
        Newly emphasized
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        De-emphasized
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResumeComparisonView({
  original,
  tailored,
}: {
  original: OriginalProfile;
  tailored: TailoredResumeContent;
}) {
  return (
    <div className="space-y-6">
      <DiffLegend />

      <SummaryComparison
        original={original.summary}
        tailored={tailored.summary}
      />

      <Separator />

      <SkillsComparison
        original={original.skills ?? []}
        tailored={tailored.highlightedSkills ?? []}
      />

      <Separator />

      <ExperienceComparison
        original={original.experience ?? []}
        tailored={tailored.experienceBlocks ?? []}
      />

      {((original.projects ?? []).length > 0 ||
        (tailored.projectHighlights ?? []).length > 0) && (
        <>
          <Separator />
          <ProjectsComparison
            original={original.projects ?? []}
            tailored={tailored.projectHighlights ?? []}
          />
        </>
      )}
    </div>
  );
}
