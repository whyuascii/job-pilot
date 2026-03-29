import { createServerFn } from '@tanstack/react-start';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@job-pilot/db';
import { applications, outcomes } from '@job-pilot/db/schema';
import { getTenantContext } from '~/lib/api';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

export const listOutcomes = createServerFn({ method: 'POST' })
  .validator((data: { applicationId: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // Verify the application belongs to the current tenant
    const app = await db.query.applications.findFirst({
      where: and(eq(applications.id, data.applicationId), eq(applications.tenantId, ctx.tenantId)),
    });

    if (!app) {
      throw new Error('Application not found');
    }

    const outcomeList = await db
      .select()
      .from(outcomes)
      .where(eq(outcomes.applicationId, data.applicationId))
      .orderBy(desc(outcomes.occurredAt));

    return outcomeList;
  });

export const addOutcome = createServerFn({ method: 'POST' })
  .validator((data: { applicationId: string; stage: string; notes?: string }) => data)
  .handler(async ({ data }) => {
    const ctx = await getTenantContext();

    // Verify the application belongs to the current tenant
    const app = await db.query.applications.findFirst({
      where: and(eq(applications.id, data.applicationId), eq(applications.tenantId, ctx.tenantId)),
    });

    if (!app) {
      throw new Error('Application not found');
    }

    const [outcome] = await db
      .insert(outcomes)
      .values({
        id: createId(),
        applicationId: data.applicationId,
        stage: data.stage,
        notes: data.notes ?? null,
      })
      .returning();

    return outcome;
  });
