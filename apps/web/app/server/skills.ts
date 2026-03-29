import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { candidates, skills } from '@job-pilot/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(
      eq(candidates.tenantId, ctx.tenantId),
      eq(candidates.userId, ctx.userId),
    ),
  });
  if (!candidate) throw new Error('No candidate profile found');
  return candidate;
}

export const listSkills = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const candidateSkills = await db.query.skills.findMany({
    where: eq(skills.candidateId, candidate.id),
  });

  return candidateSkills;
});

export const addSkill = createServerFn({ method: 'POST' }).validator(
  (data: {
    name: string;
    category: string;
    confidenceScore?: number;
    yearsUsed?: number;
    lastUsed?: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const [skill] = await db
    .insert(skills)
    .values({
      candidateId: candidate.id,
      name: data.name,
      category: data.category,
      confidenceScore: data.confidenceScore ?? 50,
      yearsUsed: data.yearsUsed,
      lastUsed: data.lastUsed ? new Date(data.lastUsed) : undefined,
    })
    .returning();

  return skill;
});

export const updateSkill = createServerFn({ method: 'POST' }).validator(
  (data: {
    skillId: string;
    name?: string;
    category?: string;
    confidenceScore?: number;
    yearsUsed?: number;
    lastUsed?: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const { skillId, ...updates } = data;

  const [updated] = await db
    .update(skills)
    .set({
      ...updates,
      lastUsed: updates.lastUsed ? new Date(updates.lastUsed) : undefined,
    })
    .where(and(eq(skills.id, skillId), eq(skills.candidateId, candidate.id)))
    .returning();

  if (!updated) {
    throw new Error('Skill not found');
  }

  return updated;
});

export const deleteSkill = createServerFn({ method: 'POST' }).validator(
  (data: { skillId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  await db
    .delete(skills)
    .where(and(eq(skills.id, data.skillId), eq(skills.candidateId, candidate.id)));

  return { success: true };
});

export const bulkAddSkills = createServerFn({ method: 'POST' }).validator(
  (data: {
    skills: Array<{
      name: string;
      category: string;
      confidenceScore?: number;
    }>;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  if (data.skills.length === 0) {
    return [];
  }

  const values = data.skills.map((s) => ({
    candidateId: candidate.id,
    name: s.name,
    category: s.category,
    confidenceScore: s.confidenceScore ?? 50,
  }));

  const inserted = await db.insert(skills).values(values).returning();

  return inserted;
});
