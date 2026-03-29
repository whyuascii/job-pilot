import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { candidates, preferences } from '@job-pilot/db/schema';
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

export const listPreferences = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const candidatePreferences = await db.query.preferences.findMany({
    where: eq(preferences.candidateId, candidate.id),
  });

  return candidatePreferences;
});

export const addPreference = createServerFn({ method: 'POST' }).validator(
  (data: {
    key: string;
    value: string;
    category: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const [preference] = await db
    .insert(preferences)
    .values({
      candidateId: candidate.id,
      key: data.key,
      value: data.value,
      category: data.category,
    })
    .returning();

  return preference;
});

export const updatePreference = createServerFn({ method: 'POST' }).validator(
  (data: {
    preferenceId: string;
    key?: string;
    value?: string;
    category?: string;
  }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  const { preferenceId, ...updates } = data;

  const [updated] = await db
    .update(preferences)
    .set(updates)
    .where(
      and(
        eq(preferences.id, preferenceId),
        eq(preferences.candidateId, candidate.id),
      )
    )
    .returning();

  if (!updated) {
    throw new Error('Preference not found');
  }

  return updated;
});

export const deletePreference = createServerFn({ method: 'POST' }).validator(
  (data: { preferenceId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();
  const candidate = await getCurrentCandidate(ctx);

  await db
    .delete(preferences)
    .where(
      and(
        eq(preferences.id, data.preferenceId),
        eq(preferences.candidateId, candidate.id),
      )
    );

  return { success: true };
});
