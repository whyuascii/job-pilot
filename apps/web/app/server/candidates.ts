import { createServerFn } from '@tanstack/react-start';
import { and, eq } from 'drizzle-orm';
import { db } from '@job-pilot/db';
import { candidates, experienceBlocks, preferences, projects, skills } from '@job-pilot/db/schema';
import { getTenantContext } from '~/lib/api';
import { sanitizeText } from '~/lib/sanitize';

export const getCandidate = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  // Try cache first
  const cacheKey = `candidate:${ctx.tenantId}:${ctx.userId}`;
  const { cacheGet, cacheSet } = await import('~/lib/cache');
  const cached =
    await cacheGet<ReturnType<typeof getCandidate> extends Promise<infer R> ? R : never>(cacheKey);
  if (cached) return cached;

  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });

  if (!candidate) {
    return null;
  }

  const [candidateSkills, experience, candidateProjects, candidatePreferences] = await Promise.all([
    db.query.skills.findMany({
      where: eq(skills.candidateId, candidate.id),
    }),
    db.query.experienceBlocks.findMany({
      where: eq(experienceBlocks.candidateId, candidate.id),
      orderBy: (eb, { desc }) => [desc(eb.startDate)],
    }),
    db.query.projects.findMany({
      where: eq(projects.candidateId, candidate.id),
    }),
    db.query.preferences.findMany({
      where: eq(preferences.candidateId, candidate.id),
    }),
  ]);

  const result = {
    ...candidate,
    skills: candidateSkills,
    experience,
    projects: candidateProjects,
    preferences: candidatePreferences,
  };

  await cacheSet(cacheKey, result, 600); // 10 min TTL

  return result;
});

export const updateCandidate = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      email?: string | null;
      phone?: string | null;
      legalName?: string | null;
      preferredName?: string | null;
      headline?: string;
      summary?: string;
      yearsOfExperience?: number;
      currentTitle?: string;
      currentCompany?: string | null;
      location?: string;
      remotePreference?: string;
      salaryMin?: number | null;
      salaryMax?: number | null;
      salaryCurrency?: string;
      visaRequired?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // Sanitize free-text fields
    if (data.legalName) data.legalName = sanitizeText(data.legalName);
    if (data.preferredName) data.preferredName = sanitizeText(data.preferredName);
    if (data.headline) data.headline = sanitizeText(data.headline);
    if (data.summary) data.summary = sanitizeText(data.summary);
    if (data.currentTitle) data.currentTitle = sanitizeText(data.currentTitle);
    if (data.currentCompany) data.currentCompany = sanitizeText(data.currentCompany);
    if (data.location) data.location = sanitizeText(data.location);

    const candidate = await db.query.candidates.findFirst({
      where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
    });

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const [updated] = await db
      .update(candidates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(candidates.id, candidate.id), eq(candidates.tenantId, ctx.tenantId)))
      .returning();

    // Invalidate cached candidate profile and dashboard (profile changes affect scores)
    const { cacheDelete, cacheDeletePattern } = await import('~/lib/cache');
    await cacheDelete(`candidate:${ctx.tenantId}:${ctx.userId}`);
    await cacheDeletePattern(`dashboard:${ctx.tenantId}`);

    return updated;
  });
