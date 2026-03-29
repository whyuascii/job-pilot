import { Router } from 'express';
import { db } from '@job-pilot/db';
import { notifications } from '@job-pilot/db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { getTenantContext } from '../lib/context.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const list = await db.query.notifications.findMany({
      where: and(eq(notifications.tenantId, ctx.tenantId), eq(notifications.userId, ctx.userId)),
      orderBy: [desc(notifications.createdAt)],
      limit: 50,
    });
    res.json(list);
  } catch (e) { next(e); }
});

router.post('/read', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { notificationId } = req.body;
    const [updated] = await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.tenantId, ctx.tenantId),
        eq(notifications.userId, ctx.userId),
      ))
      .returning();
    if (!updated) throw new Error('Notification not found');
    res.json(updated);
  } catch (e) { next(e); }
});

router.post('/read-all', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    await db.update(notifications)
      .set({ read: true })
      .where(and(
        eq(notifications.tenantId, ctx.tenantId),
        eq(notifications.userId, ctx.userId),
        eq(notifications.read, false),
      ));
    res.json({ success: true });
  } catch (e) { next(e); }
});

router.get('/unread-count', async (_req, res, next) => {
  try {
    const ctx = getTenantContext();
    const [result] = await db.select({ count: count() })
      .from(notifications)
      .where(and(
        eq(notifications.tenantId, ctx.tenantId),
        eq(notifications.userId, ctx.userId),
        eq(notifications.read, false),
      ));
    res.json({ count: result?.count ?? 0 });
  } catch (e) { next(e); }
});

// Helper for other modules to create notifications
export async function createNotification(params: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  await db.insert(notifications).values({
    id: createId(),
    tenantId: params.tenantId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
    read: false,
  });
}

export async function notifyUser(
  ctx: { tenantId: string; userId: string },
  data: { type: string; title: string; message: string; link?: string },
) {
  await createNotification({ ...ctx, ...data });
}

export default router;
