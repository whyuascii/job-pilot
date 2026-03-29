import { createServerFn } from '@tanstack/react-start';
import { db } from '@job-pilot/db';
import { notifications } from '@job-pilot/db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { getTenantContext } from '~/lib/api';
import type { NotificationType } from '@job-pilot/shared';

/**
 * List the most recent 50 notifications for the current user.
 * Unread notifications are returned first, then by creation date descending.
 */
export const listNotifications = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const results = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, ctx.tenantId),
        eq(notifications.userId, ctx.userId),
      )
    )
    .orderBy(
      sql`${notifications.read} ASC`,
      desc(notifications.createdAt),
    )
    .limit(50);

  return results;
});

/**
 * Mark a single notification as read.
 */
export const markNotificationRead = createServerFn({ method: 'POST' }).validator(
  (data: { notificationId: string }) => data,
).handler(async ({ data }) => {
  const ctx = await getTenantContext();

  const [updated] = await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, data.notificationId),
        eq(notifications.tenantId, ctx.tenantId),
        eq(notifications.userId, ctx.userId),
      )
    )
    .returning();

  if (!updated) {
    throw new Error('Notification not found');
  }

  return updated;
});

/**
 * Mark all notifications as read for the current user.
 */
export const markAllNotificationsRead = createServerFn({ method: 'POST' }).handler(async () => {
  const ctx = await getTenantContext();

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.tenantId, ctx.tenantId),
        eq(notifications.userId, ctx.userId),
        eq(notifications.read, false),
      )
    );

  return { success: true };
});

/**
 * Get the count of unread notifications for the current user.
 */
export const getUnreadCount = createServerFn({ method: 'GET' }).handler(async () => {
  const ctx = await getTenantContext();

  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, ctx.tenantId),
        eq(notifications.userId, ctx.userId),
        eq(notifications.read, false),
      )
    );

  return { count: result?.count ?? 0 };
});

/**
 * Create a notification. This is an internal helper meant to be called
 * from other server functions (not directly from the client).
 *
 * Usage from another server function:
 *   import { createNotification } from './notifications';
 *   await createNotification({
 *     tenantId: ctx.tenantId,
 *     userId: ctx.userId,
 *     type: 'job_scored',
 *     title: 'Job scored',
 *     message: 'Senior Engineer at Acme scored 92%',
 *     link: '/jobs/abc123',
 *   });
 */
export async function createNotification(params: {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}): Promise<void> {
  await db.insert(notifications).values({
    tenantId: params.tenantId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
  });
}

/**
 * Helper to send a notification to a user from within any server function.
 * Wraps createNotification with a friendlier API for common use cases.
 *
 * Usage:
 *   import { notifyUser } from '~/server/notifications';
 *   await notifyUser(ctx, {
 *     type: 'high_score_job',
 *     title: 'High-scoring job found!',
 *     message: 'Senior Engineer at Acme scored 95%',
 *     link: '/jobs/abc123',
 *   });
 */
export async function notifyUser(
  ctx: { tenantId: string; userId: string },
  notification: {
    type: NotificationType;
    title: string;
    message: string;
    link?: string | null;
  },
): Promise<void> {
  await createNotification({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    ...notification,
  });
}
