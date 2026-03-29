import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { db } from '@job-pilot/db';
import { candidates, jobs, skills } from '@job-pilot/db/schema';
import { getTenantContext } from '~/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchedSkill {
  jobSkill: string;
  candidateSkill: string;
  confidenceScore: number;
}

export interface SkillGapAnalysis {
  matchedMustHave: MatchedSkill[];
  missingMustHave: string[];
  matchedNiceToHave: MatchedSkill[];
  missingNiceToHave: string[];
  extraSkills: Array<{ name: string; category: string; confidenceScore: number }>;
  mustHaveMatchPercentage: number;
  niceToHaveMatchPercentage: number;
  overallMatchPercentage: number;
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Skill Matching Helpers
// ---------------------------------------------------------------------------

/** Common variations map for fuzzy skill matching. */
const SKILL_ALIASES: Record<string, string[]> = {
  javascript: [
    'js',
    'ecmascript',
    'es6',
    'es2015',
    'es2016',
    'es2017',
    'es2018',
    'es2019',
    'es2020',
    'es2021',
    'es2022',
    'es2023',
  ],
  typescript: ['ts'],
  react: ['react.js', 'reactjs', 'react js'],
  node: ['node.js', 'nodejs', 'node js'],
  vue: ['vue.js', 'vuejs', 'vue js'],
  angular: ['angular.js', 'angularjs', 'angular js'],
  next: ['next.js', 'nextjs', 'next js'],
  nuxt: ['nuxt.js', 'nuxtjs', 'nuxt js'],
  express: ['express.js', 'expressjs'],
  nest: ['nest.js', 'nestjs'],
  svelte: ['svelte.js', 'sveltejs'],
  postgres: ['postgresql', 'pg', 'psql'],
  mongo: ['mongodb', 'mongo db'],
  redis: ['redis db'],
  mysql: ['my sql'],
  graphql: ['graph ql'],
  docker: ['docker engine'],
  kubernetes: ['k8s', 'kube'],
  aws: ['amazon web services'],
  gcp: ['google cloud', 'google cloud platform'],
  azure: ['microsoft azure'],
  'ci/cd': ['cicd', 'ci cd', 'continuous integration', 'continuous deployment'],
  css: ['css3'],
  html: ['html5'],
  python: ['python3', 'py'],
  ruby: ['ruby lang'],
  golang: ['go lang', 'go'],
  rust: ['rust lang'],
  csharp: ['c#', 'c sharp'],
  cpp: ['c++', 'cplusplus'],
  tailwind: ['tailwind css', 'tailwindcss'],
  sass: ['scss'],
  rest: ['rest api', 'restful', 'rest apis', 'restful api'],
  git: ['github', 'gitlab', 'bitbucket'],
  terraform: ['tf'],
  elasticsearch: ['elastic search', 'elastic'],
};

/**
 * Normalize a skill name for comparison: lowercase, trim, strip trailing
 * ".js" / "js" suffixes to enable matching "React" vs "React.js".
 */
function normalizeSkill(raw: string): string {
  return raw.toLowerCase().trim();
}

/**
 * Build a set of all normalized aliases for a given skill string.
 * Includes the normalized form itself plus any known aliases.
 */
function getSkillVariants(skill: string): Set<string> {
  const normalized = normalizeSkill(skill);
  const variants = new Set<string>([normalized]);

  // Check if this skill has aliases (as a key)
  for (const [canonical, alts] of Object.entries(SKILL_ALIASES)) {
    if (normalized === canonical || alts.includes(normalized)) {
      variants.add(canonical);
      for (const alt of alts) {
        variants.add(alt);
      }
    }
  }

  // Also add a version without ".js" suffix for framework matching
  if (normalized.endsWith('.js')) {
    variants.add(normalized.slice(0, -3));
  }
  // And add a version with ".js" if it doesn't have it
  if (!normalized.endsWith('.js') && !normalized.includes(' ')) {
    variants.add(normalized + '.js');
  }

  return variants;
}

/**
 * Check whether two skill strings are considered a match.
 * Case-insensitive with alias/variation awareness.
 */
function skillsMatch(candidateSkill: string, jobSkill: string): boolean {
  const candidateVariants = getSkillVariants(candidateSkill);
  const jobVariants = getSkillVariants(jobSkill);

  for (const v of candidateVariants) {
    if (jobVariants.has(v)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Server Function
// ---------------------------------------------------------------------------

export const getSkillGap = createServerFn({ method: 'GET' })
  .validator((data: { jobId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // 1. Get the candidate for this user
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });

    if (!candidate) {
      throw new Error('No candidate profile found. Create one before using skill gap analysis.');
    }

    // 2. Load the job
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, data.jobId), eq(jobs.tenantId, ctx.tenantId)),
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // 3. Load candidate skills
    const candidateSkills = await db.query.skills.findMany({
      where: eq(skills.candidateId, candidate.id),
    });

    // 4. Compute matches
    const mustHaveSkills = (job.mustHaveSkills as string[]) ?? [];
    const niceToHaveSkills = (job.niceToHaveSkills as string[]) ?? [];

    const matchedMustHave: MatchedSkill[] = [];
    const missingMustHave: string[] = [];
    const matchedNiceToHave: MatchedSkill[] = [];
    const missingNiceToHave: string[] = [];

    // Track which candidate skills were matched to any job requirement
    const matchedCandidateSkillIds = new Set<string>();

    // Check must-have skills
    for (const jobSkill of mustHaveSkills) {
      let found = false;
      for (const cs of candidateSkills) {
        if (skillsMatch(cs.name, jobSkill)) {
          matchedMustHave.push({
            jobSkill,
            candidateSkill: cs.name,
            confidenceScore: cs.confidenceScore,
          });
          matchedCandidateSkillIds.add(cs.id);
          found = true;
          break;
        }
      }
      if (!found) {
        missingMustHave.push(jobSkill);
      }
    }

    // Check nice-to-have skills
    for (const jobSkill of niceToHaveSkills) {
      let found = false;
      for (const cs of candidateSkills) {
        if (skillsMatch(cs.name, jobSkill)) {
          matchedNiceToHave.push({
            jobSkill,
            candidateSkill: cs.name,
            confidenceScore: cs.confidenceScore,
          });
          matchedCandidateSkillIds.add(cs.id);
          found = true;
          break;
        }
      }
      if (!found) {
        missingNiceToHave.push(jobSkill);
      }
    }

    // Extra skills: candidate skills not in either list
    const extraSkills = candidateSkills
      .filter((cs) => !matchedCandidateSkillIds.has(cs.id))
      .map((cs) => ({
        name: cs.name,
        category: cs.category,
        confidenceScore: cs.confidenceScore,
      }));

    // 5. Calculate percentages
    const mustHaveMatchPercentage =
      mustHaveSkills.length > 0
        ? Math.round((matchedMustHave.length / mustHaveSkills.length) * 100)
        : 100;

    const niceToHaveMatchPercentage =
      niceToHaveSkills.length > 0
        ? Math.round((matchedNiceToHave.length / niceToHaveSkills.length) * 100)
        : 100;

    // Weighted overall: must-have weighted 2x, nice-to-have 1x
    const totalWeight = mustHaveSkills.length * 2 + niceToHaveSkills.length;
    const earnedWeight = matchedMustHave.length * 2 + matchedNiceToHave.length;
    const overallMatchPercentage =
      totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;

    // 6. Generate recommendation text
    const recommendation = generateRecommendation({
      mustHaveMatchPercentage,
      niceToHaveMatchPercentage,
      overallMatchPercentage,
      missingMustHaveCount: missingMustHave.length,
      missingMustHave,
      matchedMustHaveCount: matchedMustHave.length,
      mustHaveTotal: mustHaveSkills.length,
      niceToHaveTotal: niceToHaveSkills.length,
      matchedNiceToHaveCount: matchedNiceToHave.length,
      extraSkillsCount: extraSkills.length,
    });

    const result: SkillGapAnalysis = {
      matchedMustHave,
      missingMustHave,
      matchedNiceToHave,
      missingNiceToHave,
      extraSkills,
      mustHaveMatchPercentage,
      niceToHaveMatchPercentage,
      overallMatchPercentage,
      recommendation,
    };

    return result;
  });

// ---------------------------------------------------------------------------
// Recommendation Text Generator
// ---------------------------------------------------------------------------

function generateRecommendation(params: {
  mustHaveMatchPercentage: number;
  niceToHaveMatchPercentage: number;
  overallMatchPercentage: number;
  missingMustHaveCount: number;
  missingMustHave: string[];
  matchedMustHaveCount: number;
  mustHaveTotal: number;
  niceToHaveTotal: number;
  matchedNiceToHaveCount: number;
  extraSkillsCount: number;
}): string {
  const {
    mustHaveMatchPercentage,
    overallMatchPercentage,
    missingMustHaveCount,
    missingMustHave,
    matchedMustHaveCount,
    mustHaveTotal,
    niceToHaveTotal,
    matchedNiceToHaveCount,
    extraSkillsCount,
  } = params;

  const parts: string[] = [];

  // Overall assessment
  if (overallMatchPercentage >= 80) {
    parts.push('Excellent skill match for this role.');
  } else if (overallMatchPercentage >= 60) {
    parts.push('Good skill match with some gaps to address.');
  } else if (overallMatchPercentage >= 40) {
    parts.push('Moderate skill match - several key gaps exist.');
  } else {
    parts.push('Significant skill gaps for this role.');
  }

  // Must-have details
  if (mustHaveTotal > 0) {
    if (mustHaveMatchPercentage === 100) {
      parts.push(`You match all ${mustHaveTotal} must-have requirements.`);
    } else {
      parts.push(`You match ${matchedMustHaveCount} of ${mustHaveTotal} must-have skills.`);
      if (missingMustHaveCount > 0 && missingMustHaveCount <= 3) {
        parts.push(`Consider brushing up on: ${missingMustHave.join(', ')}.`);
      } else if (missingMustHaveCount > 3) {
        parts.push(
          `Key gaps include: ${missingMustHave.slice(0, 3).join(', ')}, and ${missingMustHaveCount - 3} more.`,
        );
      }
    }
  }

  // Nice-to-have details
  if (niceToHaveTotal > 0) {
    parts.push(`You have ${matchedNiceToHaveCount} of ${niceToHaveTotal} nice-to-have skills.`);
  }

  // Bonus skills
  if (extraSkillsCount > 0) {
    parts.push(
      `You also bring ${extraSkillsCount} additional skill${extraSkillsCount === 1 ? '' : 's'} not listed in the requirements.`,
    );
  }

  return parts.join(' ');
}
