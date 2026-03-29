import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { candidates, projects } from '@job-pilot/db/schema';
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

export const listProjects = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const candidateProjects = await db.query.projects.findMany({
    where: eq(projects.candidateId, candidate.id),
  });

  return candidateProjects;
});

export const addProject = createServerFn({ method: 'POST' }).validator(
  (data: {
    name: string;
    description: string;
    url?: string;
    skills?: string[];
    highlights?: string[];
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const [project] = await db
    .insert(projects)
    .values({
      candidateId: candidate.id,
      name: data.name,
      description: data.description,
      url: data.url,
      skills: data.skills ?? [],
      highlights: data.highlights ?? [],
    })
    .returning();

  return project;
});

export const updateProject = createServerFn({ method: 'POST' }).validator(
  (data: {
    projectId: string;
    name?: string;
    description?: string;
    url?: string;
    skills?: string[];
    highlights?: string[];
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const { projectId, ...updates } = data;

  const [updated] = await db
    .update(projects)
    .set(updates)
    .where(and(eq(projects.id, projectId), eq(projects.candidateId, candidate.id)))
    .returning();

  if (!updated) {
    throw new Error('Project not found');
  }

  return updated;
});

export const deleteProject = createServerFn({ method: 'POST' }).validator(
  (data: { projectId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  await db
    .delete(projects)
    .where(and(eq(projects.id, data.projectId), eq(projects.candidateId, candidate.id)));

  return { success: true };
});
