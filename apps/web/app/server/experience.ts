import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@job-pilot/db';
import { candidates, experienceBlocks } from '@job-pilot/db/schema';
import { getTenantContext } from '~/lib/api';

async function getCurrentCandidate(ctx: { tenantId: string; userId: string }) {
  const candidate = await db.query.candidates.findFirst({
    where: and(eq(candidates.tenantId, ctx.tenantId), eq(candidates.userId, ctx.userId)),
  });
  if (!candidate) throw new Error('No candidate profile found');
  return candidate;
}

export const listExperience = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const experience = await db.query.experienceBlocks.findMany({
    where: eq(experienceBlocks.candidateId, candidate.id),
    orderBy: [desc(experienceBlocks.startDate)],
  });

  return experience;
});

export const addExperience = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      company: string;
      title: string;
      location?: string;
      startDate: string;
      endDate?: string;
      current?: boolean;
      description?: string;
      bullets?: string[];
      skills?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    const candidate = await getCurrentCandidate(ctx);

    const [experience] = await db
      .insert(experienceBlocks)
      .values({
        candidateId: candidate.id,
        company: data.company,
        title: data.title,
        location: data.location ?? '',
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        current: data.current ?? false,
        description: data.description ?? '',
        bullets: data.bullets ?? [],
        skills: data.skills ?? [],
      })
      .returning();

    return experience;
  });

export const updateExperience = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      experienceId: string;
      company?: string;
      title?: string;
      location?: string;
      startDate?: string;
      endDate?: string;
      current?: boolean;
      description?: string;
      bullets?: string[];
      skills?: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    const candidate = await getCurrentCandidate(ctx);

    const { experienceId, startDate, endDate, ...rest } = data;

    const updates: Record<string, unknown> = { ...rest };
    if (startDate !== undefined) {
      updates.startDate = new Date(startDate);
    }
    if (endDate !== undefined) {
      updates.endDate = new Date(endDate);
    }

    const [updated] = await db
      .update(experienceBlocks)
      .set(updates)
      .where(
        and(eq(experienceBlocks.id, experienceId), eq(experienceBlocks.candidateId, candidate.id)),
      )
      .returning();

    if (!updated) {
      throw new Error('Experience block not found');
    }

    return updated;
  });

export const deleteExperience = createServerFn({ method: 'POST' })
  .validator((data: { experienceId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();
    const candidate = await getCurrentCandidate(ctx);

    await db
      .delete(experienceBlocks)
      .where(
        and(
          eq(experienceBlocks.id, data.experienceId),
          eq(experienceBlocks.candidateId, candidate.id),
        ),
      );

    return { success: true };
  });
