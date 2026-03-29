import { and, eq } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '@job-pilot/db';
import { candidates, jobs, skills } from '@job-pilot/db/schema';
import { getTenantContext } from '../lib/context.js';

const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['js', 'ecmascript', 'es6', 'es2015'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js'],
  'node.js': ['nodejs', 'node'],
  python: ['py', 'python3'],
  kubernetes: ['k8s'],
  postgresql: ['postgres', 'psql'],
  mongodb: ['mongo'],
  'amazon web services': ['aws'],
  'google cloud platform': ['gcp'],
  'microsoft azure': ['azure'],
  docker: ['containers', 'containerization'],
  'ci/cd': ['continuous integration', 'continuous deployment', 'cicd'],
  graphql: ['gql'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  'next.js': ['nextjs'],
  vue: ['vuejs', 'vue.js'],
  angular: ['angularjs'],
  'ruby on rails': ['rails', 'ror'],
  '.net': ['dotnet'],
  'c#': ['csharp'],
  'c++': ['cpp'],
};

function normalizeSkillName(name: string): string {
  return name.toLowerCase().trim();
}

function skillsMatch(candidateSkill: string, requiredSkill: string): boolean {
  const cs = normalizeSkillName(candidateSkill);
  const rs = normalizeSkillName(requiredSkill);
  if (cs === rs) return true;
  if (cs.includes(rs) || rs.includes(cs)) return true;
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    const allVariants = [canonical, ...aliases];
    const csMatch = allVariants.some((v) => v === cs || cs.includes(v));
    const rsMatch = allVariants.some((v) => v === rs || rs.includes(v));
    if (csMatch && rsMatch) return true;
  }
  return false;
}

const router = Router();

router.get('/:jobId', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, req.params.jobId), eq(jobs.tenantId, ctx.tenantId)),
    });
    if (!job) throw new Error('Job not found');
    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });
    if (!candidate) throw new Error('No candidate profile found.');
    const candidateSkills = await db.query.skills.findMany({
      where: eq(skills.candidateId, candidate.id),
    });
    const mustHave = (job.mustHaveSkills as string[] | null) ?? [];
    const niceToHave = (job.niceToHaveSkills as string[] | null) ?? [];
    const candidateSkillNames = candidateSkills.map((s) => s.name);
    const matchedMustHave: string[] = [];
    const missingMustHave: string[] = [];
    for (const skill of mustHave) {
      const found = candidateSkillNames.some((cs) => skillsMatch(cs, skill));
      if (found) matchedMustHave.push(skill);
      else missingMustHave.push(skill);
    }
    const matchedNiceToHave: string[] = [];
    const missingNiceToHave: string[] = [];
    for (const skill of niceToHave) {
      const found = candidateSkillNames.some((cs) => skillsMatch(cs, skill));
      if (found) matchedNiceToHave.push(skill);
      else missingNiceToHave.push(skill);
    }
    const mustHaveScore =
      mustHave.length > 0 ? Math.round((matchedMustHave.length / mustHave.length) * 100) : 100;
    const niceToHaveScore =
      niceToHave.length > 0
        ? Math.round((matchedNiceToHave.length / niceToHave.length) * 100)
        : 100;
    const overallScore = Math.round(mustHaveScore * 0.7 + niceToHaveScore * 0.3);
    res.json({
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      mustHave: {
        total: mustHave.length,
        matched: matchedMustHave,
        missing: missingMustHave,
        score: mustHaveScore,
      },
      niceToHave: {
        total: niceToHave.length,
        matched: matchedNiceToHave,
        missing: missingNiceToHave,
        score: niceToHaveScore,
      },
      overallScore,
      candidateSkills: candidateSkillNames,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
