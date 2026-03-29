import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Tests for the skill gap matching logic. These test the pure functions
// (normalizeSkill, getSkillVariants, skillsMatch, generateRecommendation)
// extracted from the skill-gap module.
//
// Since the server function is wrapped in createServerFn with DB calls,
// we re-implement the pure logic here to test it in isolation.
// ---------------------------------------------------------------------------

// --- Re-implement the pure functions from skill-gap.ts ---

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['js', 'ecmascript', 'es6', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020', 'es2021', 'es2022', 'es2023'],
  typescript: ['ts'],
  'react': ['react.js', 'reactjs', 'react js'],
  'node': ['node.js', 'nodejs', 'node js'],
  'vue': ['vue.js', 'vuejs', 'vue js'],
  'angular': ['angular.js', 'angularjs', 'angular js'],
  'next': ['next.js', 'nextjs', 'next js'],
  'nuxt': ['nuxt.js', 'nuxtjs', 'nuxt js'],
  'express': ['express.js', 'expressjs'],
  'nest': ['nest.js', 'nestjs'],
  'svelte': ['svelte.js', 'sveltejs'],
  'postgres': ['postgresql', 'pg', 'psql'],
  'mongo': ['mongodb', 'mongo db'],
  'redis': ['redis db'],
  'mysql': ['my sql'],
  'graphql': ['graph ql'],
  'docker': ['docker engine'],
  'kubernetes': ['k8s', 'kube'],
  'aws': ['amazon web services'],
  'gcp': ['google cloud', 'google cloud platform'],
  'azure': ['microsoft azure'],
  'ci/cd': ['cicd', 'ci cd', 'continuous integration', 'continuous deployment'],
  'css': ['css3'],
  'html': ['html5'],
  'python': ['python3', 'py'],
  'ruby': ['ruby lang'],
  'golang': ['go lang', 'go'],
  'rust': ['rust lang'],
  'csharp': ['c#', 'c sharp'],
  'cpp': ['c++', 'cplusplus'],
  'tailwind': ['tailwind css', 'tailwindcss'],
  'sass': ['scss'],
  'rest': ['rest api', 'restful', 'rest apis', 'restful api'],
  'git': ['github', 'gitlab', 'bitbucket'],
  'terraform': ['tf'],
  'elasticsearch': ['elastic search', 'elastic'],
};

function normalizeSkill(raw: string): string {
  return raw.toLowerCase().trim();
}

function getSkillVariants(skill: string): Set<string> {
  const normalized = normalizeSkill(skill);
  const variants = new Set<string>([normalized]);

  for (const [canonical, alts] of Object.entries(SKILL_ALIASES)) {
    if (normalized === canonical || alts.includes(normalized)) {
      variants.add(canonical);
      for (const alt of alts) {
        variants.add(alt);
      }
    }
  }

  if (normalized.endsWith('.js')) {
    variants.add(normalized.slice(0, -3));
  }
  if (!normalized.endsWith('.js') && !normalized.includes(' ')) {
    variants.add(normalized + '.js');
  }

  return variants;
}

function skillsMatch(candidateSkill: string, jobSkill: string): boolean {
  const candidateVariants = getSkillVariants(candidateSkill);
  const jobVariants = getSkillVariants(jobSkill);

  for (const v of candidateVariants) {
    if (jobVariants.has(v)) return true;
  }

  return false;
}

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

  if (overallMatchPercentage >= 80) {
    parts.push('Excellent skill match for this role.');
  } else if (overallMatchPercentage >= 60) {
    parts.push('Good skill match with some gaps to address.');
  } else if (overallMatchPercentage >= 40) {
    parts.push('Moderate skill match - several key gaps exist.');
  } else {
    parts.push('Significant skill gaps for this role.');
  }

  if (mustHaveTotal > 0) {
    if (params.mustHaveMatchPercentage === 100) {
      parts.push(`You match all ${mustHaveTotal} must-have requirements.`);
    } else {
      parts.push(
        `You match ${matchedMustHaveCount} of ${mustHaveTotal} must-have skills.`,
      );
      if (missingMustHaveCount > 0 && missingMustHaveCount <= 3) {
        parts.push(
          `Consider brushing up on: ${missingMustHave.join(', ')}.`,
        );
      } else if (missingMustHaveCount > 3) {
        parts.push(
          `Key gaps include: ${missingMustHave.slice(0, 3).join(', ')}, and ${missingMustHaveCount - 3} more.`,
        );
      }
    }
  }

  if (niceToHaveTotal > 0) {
    parts.push(
      `You have ${matchedNiceToHaveCount} of ${niceToHaveTotal} nice-to-have skills.`,
    );
  }

  if (extraSkillsCount > 0) {
    parts.push(
      `You also bring ${extraSkillsCount} additional skill${extraSkillsCount === 1 ? '' : 's'} not listed in the requirements.`,
    );
  }

  return parts.join(' ');
}

// --- Helper to run a full skill gap analysis ---

interface CandidateSkill {
  id: string;
  name: string;
  category: string;
  confidenceScore: number;
}

function analyzeSkillGap(
  candidateSkills: CandidateSkill[],
  mustHaveSkills: string[],
  niceToHaveSkills: string[],
) {
  const matchedMustHave: { jobSkill: string; candidateSkill: string; confidenceScore: number }[] = [];
  const missingMustHave: string[] = [];
  const matchedNiceToHave: { jobSkill: string; candidateSkill: string; confidenceScore: number }[] = [];
  const missingNiceToHave: string[] = [];
  const matchedCandidateSkillIds = new Set<string>();

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
    if (!found) missingMustHave.push(jobSkill);
  }

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
    if (!found) missingNiceToHave.push(jobSkill);
  }

  const extraSkills = candidateSkills
    .filter((cs) => !matchedCandidateSkillIds.has(cs.id))
    .map((cs) => ({ name: cs.name, category: cs.category, confidenceScore: cs.confidenceScore }));

  const mustHaveMatchPercentage =
    mustHaveSkills.length > 0
      ? Math.round((matchedMustHave.length / mustHaveSkills.length) * 100)
      : 100;

  const niceToHaveMatchPercentage =
    niceToHaveSkills.length > 0
      ? Math.round((matchedNiceToHave.length / niceToHaveSkills.length) * 100)
      : 100;

  const totalWeight = mustHaveSkills.length * 2 + niceToHaveSkills.length;
  const earnedWeight = matchedMustHave.length * 2 + matchedNiceToHave.length;
  const overallMatchPercentage =
    totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;

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

  return {
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
}

// ---------------------------------------------------------------------------
// normalizeSkill
// ---------------------------------------------------------------------------

describe('normalizeSkill', () => {
  it('converts to lowercase', () => {
    expect(normalizeSkill('TypeScript')).toBe('typescript');
  });

  it('trims whitespace', () => {
    expect(normalizeSkill('  React  ')).toBe('react');
  });

  it('handles mixed case and whitespace', () => {
    expect(normalizeSkill('  Node.JS  ')).toBe('node.js');
  });

  it('handles empty string', () => {
    expect(normalizeSkill('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getSkillVariants
// ---------------------------------------------------------------------------

describe('getSkillVariants', () => {
  it('includes the normalized form', () => {
    const variants = getSkillVariants('TypeScript');
    expect(variants.has('typescript')).toBe(true);
  });

  it('includes aliases for known skill (typescript -> ts)', () => {
    const variants = getSkillVariants('TypeScript');
    expect(variants.has('ts')).toBe(true);
  });

  it('includes aliases when given an alias (ts -> typescript)', () => {
    const variants = getSkillVariants('ts');
    expect(variants.has('typescript')).toBe(true);
  });

  it('includes .js suffix variant for single-word skills', () => {
    const variants = getSkillVariants('react');
    expect(variants.has('react.js')).toBe(true);
  });

  it('strips .js suffix as a variant', () => {
    const variants = getSkillVariants('react.js');
    expect(variants.has('react')).toBe(true);
  });

  it('does not add .js for multi-word skills', () => {
    const variants = getSkillVariants('machine learning');
    expect(variants.has('machine learning.js')).toBe(false);
  });

  it('includes all JavaScript aliases', () => {
    const variants = getSkillVariants('JavaScript');
    expect(variants.has('js')).toBe(true);
    expect(variants.has('ecmascript')).toBe(true);
    expect(variants.has('es6')).toBe(true);
    expect(variants.has('es2023')).toBe(true);
  });

  it('includes kubernetes aliases', () => {
    const variants = getSkillVariants('kubernetes');
    expect(variants.has('k8s')).toBe(true);
    expect(variants.has('kube')).toBe(true);
  });

  it('resolves k8s to kubernetes', () => {
    const variants = getSkillVariants('k8s');
    expect(variants.has('kubernetes')).toBe(true);
  });

  it('includes postgres aliases', () => {
    const variants = getSkillVariants('postgres');
    expect(variants.has('postgresql')).toBe(true);
    expect(variants.has('pg')).toBe(true);
    expect(variants.has('psql')).toBe(true);
  });

  it('handles unknown skill (no aliases)', () => {
    const variants = getSkillVariants('obscure-framework');
    expect(variants.has('obscure-framework')).toBe(true);
    expect(variants.has('obscure-framework.js')).toBe(true);
    expect(variants.size).toBe(2); // normalized + .js variant
  });
});

// ---------------------------------------------------------------------------
// skillsMatch
// ---------------------------------------------------------------------------

describe('skillsMatch', () => {
  it('matches exact same skill', () => {
    expect(skillsMatch('TypeScript', 'TypeScript')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(skillsMatch('typescript', 'TYPESCRIPT')).toBe(true);
  });

  it('matches through alias (React -> React.js)', () => {
    expect(skillsMatch('React', 'React.js')).toBe(true);
  });

  it('matches through alias (React.js -> React)', () => {
    expect(skillsMatch('React.js', 'React')).toBe(true);
  });

  it('matches alias shorthand (TypeScript -> TS)', () => {
    expect(skillsMatch('TypeScript', 'TS')).toBe(true);
    expect(skillsMatch('TS', 'TypeScript')).toBe(true);
  });

  it('matches JavaScript variations', () => {
    expect(skillsMatch('JavaScript', 'JS')).toBe(true);
    expect(skillsMatch('JS', 'JavaScript')).toBe(true);
    expect(skillsMatch('JavaScript', 'ES6')).toBe(true);
    expect(skillsMatch('ECMAScript', 'JavaScript')).toBe(true);
  });

  it('matches Node.js variations', () => {
    expect(skillsMatch('Node', 'Node.js')).toBe(true);
    expect(skillsMatch('Node.js', 'NodeJS')).toBe(true);
    expect(skillsMatch('node js', 'Node')).toBe(true);
  });

  it('matches kubernetes/k8s', () => {
    expect(skillsMatch('Kubernetes', 'k8s')).toBe(true);
    expect(skillsMatch('k8s', 'Kubernetes')).toBe(true);
    expect(skillsMatch('kube', 'Kubernetes')).toBe(true);
  });

  it('matches PostgreSQL variations', () => {
    expect(skillsMatch('Postgres', 'PostgreSQL')).toBe(true);
    expect(skillsMatch('pg', 'PostgreSQL')).toBe(true);
    expect(skillsMatch('psql', 'Postgres')).toBe(true);
  });

  it('matches AWS variations', () => {
    expect(skillsMatch('AWS', 'Amazon Web Services')).toBe(true);
    expect(skillsMatch('Amazon Web Services', 'aws')).toBe(true);
  });

  it('matches C# variations', () => {
    expect(skillsMatch('C#', 'csharp')).toBe(true);
    expect(skillsMatch('C Sharp', 'csharp')).toBe(true);
  });

  it('matches C++ variations', () => {
    expect(skillsMatch('C++', 'cpp')).toBe(true);
    expect(skillsMatch('cplusplus', 'C++')).toBe(true);
  });

  it('matches CI/CD variations', () => {
    expect(skillsMatch('CI/CD', 'CICD')).toBe(true);
    expect(skillsMatch('CI/CD', 'Continuous Integration')).toBe(true);
    expect(skillsMatch('Continuous Deployment', 'CI/CD')).toBe(true);
  });

  it('matches REST API variations', () => {
    expect(skillsMatch('REST', 'REST API')).toBe(true);
    expect(skillsMatch('RESTful', 'REST')).toBe(true);
    expect(skillsMatch('REST APIs', 'REST')).toBe(true);
  });

  it('matches Tailwind CSS variations', () => {
    expect(skillsMatch('Tailwind', 'Tailwind CSS')).toBe(true);
    expect(skillsMatch('TailwindCSS', 'Tailwind')).toBe(true);
  });

  it('matches SASS/SCSS', () => {
    expect(skillsMatch('SASS', 'SCSS')).toBe(true);
    expect(skillsMatch('SCSS', 'SASS')).toBe(true);
  });

  it('matches Terraform/TF', () => {
    expect(skillsMatch('Terraform', 'TF')).toBe(true);
    expect(skillsMatch('tf', 'Terraform')).toBe(true);
  });

  it('matches Git/GitHub', () => {
    expect(skillsMatch('Git', 'GitHub')).toBe(true);
    expect(skillsMatch('GitLab', 'Git')).toBe(true);
    expect(skillsMatch('Bitbucket', 'Git')).toBe(true);
  });

  it('does NOT match unrelated skills', () => {
    expect(skillsMatch('Python', 'JavaScript')).toBe(false);
    expect(skillsMatch('React', 'Angular')).toBe(false);
    expect(skillsMatch('Docker', 'Kubernetes')).toBe(false);
  });

  it('handles whitespace in input', () => {
    expect(skillsMatch('  React  ', 'React.js')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateRecommendation
// ---------------------------------------------------------------------------

describe('generateRecommendation', () => {
  it('generates excellent recommendation for 100% match', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 100,
      niceToHaveMatchPercentage: 100,
      overallMatchPercentage: 100,
      missingMustHaveCount: 0,
      missingMustHave: [],
      matchedMustHaveCount: 5,
      mustHaveTotal: 5,
      niceToHaveTotal: 3,
      matchedNiceToHaveCount: 3,
      extraSkillsCount: 2,
    });
    expect(result).toContain('Excellent skill match');
    expect(result).toContain('match all 5 must-have');
    expect(result).toContain('3 of 3 nice-to-have');
    expect(result).toContain('2 additional skills');
  });

  it('generates good recommendation for 60-79% match', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 60,
      niceToHaveMatchPercentage: 50,
      overallMatchPercentage: 65,
      missingMustHaveCount: 2,
      missingMustHave: ['Docker', 'Kubernetes'],
      matchedMustHaveCount: 3,
      mustHaveTotal: 5,
      niceToHaveTotal: 0,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 0,
    });
    expect(result).toContain('Good skill match');
    expect(result).toContain('3 of 5 must-have');
    expect(result).toContain('Docker, Kubernetes');
  });

  it('generates moderate recommendation for 40-59% match', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 40,
      niceToHaveMatchPercentage: 30,
      overallMatchPercentage: 45,
      missingMustHaveCount: 3,
      missingMustHave: ['Go', 'Rust', 'Kubernetes'],
      matchedMustHaveCount: 2,
      mustHaveTotal: 5,
      niceToHaveTotal: 2,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 0,
    });
    expect(result).toContain('Moderate skill match');
    expect(result).toContain('2 of 5 must-have');
    expect(result).toContain('Go, Rust, Kubernetes');
  });

  it('generates significant gaps recommendation for <40% match', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 20,
      niceToHaveMatchPercentage: 0,
      overallMatchPercentage: 15,
      missingMustHaveCount: 4,
      missingMustHave: ['Go', 'Rust', 'Kubernetes', 'Terraform'],
      matchedMustHaveCount: 1,
      mustHaveTotal: 5,
      niceToHaveTotal: 3,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 0,
    });
    expect(result).toContain('Significant skill gaps');
    expect(result).toContain('1 of 5 must-have');
    // With 4 missing, should show "and 1 more"
    expect(result).toContain('and 1 more');
  });

  it('handles zero must-have skills', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 100,
      niceToHaveMatchPercentage: 50,
      overallMatchPercentage: 80,
      missingMustHaveCount: 0,
      missingMustHave: [],
      matchedMustHaveCount: 0,
      mustHaveTotal: 0,
      niceToHaveTotal: 2,
      matchedNiceToHaveCount: 1,
      extraSkillsCount: 0,
    });
    // Should not mention must-have since there are none
    expect(result).not.toContain('must-have');
    expect(result).toContain('1 of 2 nice-to-have');
  });

  it('handles zero nice-to-have skills', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 100,
      niceToHaveMatchPercentage: 100,
      overallMatchPercentage: 100,
      missingMustHaveCount: 0,
      missingMustHave: [],
      matchedMustHaveCount: 3,
      mustHaveTotal: 3,
      niceToHaveTotal: 0,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 0,
    });
    expect(result).not.toContain('nice-to-have');
  });

  it('handles both skills lists empty', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 100,
      niceToHaveMatchPercentage: 100,
      overallMatchPercentage: 100,
      missingMustHaveCount: 0,
      missingMustHave: [],
      matchedMustHaveCount: 0,
      mustHaveTotal: 0,
      niceToHaveTotal: 0,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 5,
    });
    expect(result).toContain('Excellent skill match');
    expect(result).toContain('5 additional skills');
  });

  it('uses singular "skill" for extraSkillsCount=1', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 100,
      niceToHaveMatchPercentage: 100,
      overallMatchPercentage: 100,
      missingMustHaveCount: 0,
      missingMustHave: [],
      matchedMustHaveCount: 0,
      mustHaveTotal: 0,
      niceToHaveTotal: 0,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 1,
    });
    expect(result).toContain('1 additional skill ');
    expect(result).not.toContain('1 additional skills');
  });

  it('does not mention extra skills when count is 0', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 100,
      niceToHaveMatchPercentage: 100,
      overallMatchPercentage: 100,
      missingMustHaveCount: 0,
      missingMustHave: [],
      matchedMustHaveCount: 0,
      mustHaveTotal: 0,
      niceToHaveTotal: 0,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 0,
    });
    expect(result).not.toContain('additional skill');
  });

  it('shows up to 3 missing must-have skills when exactly 3', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 40,
      niceToHaveMatchPercentage: 0,
      overallMatchPercentage: 40,
      missingMustHaveCount: 3,
      missingMustHave: ['Go', 'Rust', 'C++'],
      matchedMustHaveCount: 2,
      mustHaveTotal: 5,
      niceToHaveTotal: 0,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 0,
    });
    expect(result).toContain('Consider brushing up on: Go, Rust, C++');
    expect(result).not.toContain('and');
  });

  it('uses "Key gaps include" for >3 missing must-have skills', () => {
    const result = generateRecommendation({
      mustHaveMatchPercentage: 0,
      niceToHaveMatchPercentage: 0,
      overallMatchPercentage: 0,
      missingMustHaveCount: 5,
      missingMustHave: ['Go', 'Rust', 'C++', 'Kotlin', 'Scala'],
      matchedMustHaveCount: 0,
      mustHaveTotal: 5,
      niceToHaveTotal: 0,
      matchedNiceToHaveCount: 0,
      extraSkillsCount: 0,
    });
    expect(result).toContain('Key gaps include: Go, Rust, C++, and 2 more');
  });
});

// ---------------------------------------------------------------------------
// Full analysis integration (pure function, no DB)
// ---------------------------------------------------------------------------

describe('analyzeSkillGap - full analysis', () => {
  const candidateSkills: CandidateSkill[] = [
    { id: '1', name: 'TypeScript', category: 'language', confidenceScore: 90 },
    { id: '2', name: 'React', category: 'framework', confidenceScore: 85 },
    { id: '3', name: 'Node.js', category: 'framework', confidenceScore: 80 },
    { id: '4', name: 'PostgreSQL', category: 'tool', confidenceScore: 75 },
    { id: '5', name: 'Docker', category: 'tool', confidenceScore: 70 },
    { id: '6', name: 'Python', category: 'language', confidenceScore: 60 },
  ];

  it('matches all must-have skills through aliases', () => {
    const result = analyzeSkillGap(
      candidateSkills,
      ['TS', 'React.js', 'Node', 'Postgres'],
      [],
    );
    expect(result.matchedMustHave).toHaveLength(4);
    expect(result.missingMustHave).toHaveLength(0);
    expect(result.mustHaveMatchPercentage).toBe(100);
  });

  it('identifies missing must-have skills', () => {
    const result = analyzeSkillGap(
      candidateSkills,
      ['TypeScript', 'React', 'Go', 'Kubernetes'],
      [],
    );
    expect(result.matchedMustHave).toHaveLength(2);
    expect(result.missingMustHave).toEqual(['Go', 'Kubernetes']);
    expect(result.mustHaveMatchPercentage).toBe(50);
  });

  it('handles nice-to-have skills separately', () => {
    const result = analyzeSkillGap(
      candidateSkills,
      ['TypeScript'],
      ['Python', 'GraphQL'],
    );
    expect(result.matchedNiceToHave).toHaveLength(1);
    expect(result.missingNiceToHave).toEqual(['GraphQL']);
    expect(result.niceToHaveMatchPercentage).toBe(50);
  });

  it('identifies extra skills not in either list', () => {
    const result = analyzeSkillGap(
      candidateSkills,
      ['TypeScript', 'React'],
      ['Node.js'],
    );
    // PostgreSQL, Docker, Python are extra
    expect(result.extraSkills).toHaveLength(3);
    expect(result.extraSkills.map((s) => s.name)).toContain('PostgreSQL');
    expect(result.extraSkills.map((s) => s.name)).toContain('Docker');
    expect(result.extraSkills.map((s) => s.name)).toContain('Python');
  });

  it('calculates weighted overall percentage correctly', () => {
    // 2 must-have matched out of 3 = 2*2=4 earned, 3*2=6 available
    // 1 nice-to-have matched out of 2 = 1 earned, 2 available
    // Total: 5 / 8 = 62.5% -> 63%
    const result = analyzeSkillGap(
      candidateSkills,
      ['TypeScript', 'React', 'Go'],
      ['Python', 'GraphQL'],
    );
    expect(result.overallMatchPercentage).toBe(63);
  });

  it('returns 100% when both lists are empty', () => {
    const result = analyzeSkillGap(candidateSkills, [], []);
    expect(result.mustHaveMatchPercentage).toBe(100);
    expect(result.niceToHaveMatchPercentage).toBe(100);
    expect(result.overallMatchPercentage).toBe(100);
  });

  it('returns 0% when no skills match', () => {
    const result = analyzeSkillGap(
      candidateSkills,
      ['Haskell', 'Erlang', 'Clojure'],
      ['Prolog'],
    );
    expect(result.mustHaveMatchPercentage).toBe(0);
    expect(result.niceToHaveMatchPercentage).toBe(0);
    expect(result.overallMatchPercentage).toBe(0);
    expect(result.missingMustHave).toEqual(['Haskell', 'Erlang', 'Clojure']);
    expect(result.missingNiceToHave).toEqual(['Prolog']);
  });

  it('returns all candidate skills as extra when no job skills specified', () => {
    const result = analyzeSkillGap(candidateSkills, [], []);
    expect(result.extraSkills).toHaveLength(6);
  });

  it('includes confidence scores in matched skills', () => {
    const result = analyzeSkillGap(candidateSkills, ['TypeScript'], []);
    expect(result.matchedMustHave[0].confidenceScore).toBe(90);
    expect(result.matchedMustHave[0].candidateSkill).toBe('TypeScript');
    expect(result.matchedMustHave[0].jobSkill).toBe('TypeScript');
  });

  it('generates a recommendation string', () => {
    const result = analyzeSkillGap(
      candidateSkills,
      ['TypeScript', 'React', 'Go'],
      ['Python'],
    );
    expect(typeof result.recommendation).toBe('string');
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it('handles empty candidate skills', () => {
    const result = analyzeSkillGap(
      [],
      ['TypeScript', 'React'],
      ['Python'],
    );
    expect(result.matchedMustHave).toHaveLength(0);
    expect(result.missingMustHave).toEqual(['TypeScript', 'React']);
    expect(result.missingNiceToHave).toEqual(['Python']);
    expect(result.extraSkills).toHaveLength(0);
    expect(result.overallMatchPercentage).toBe(0);
  });
});
