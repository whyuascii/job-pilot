import { and, eq } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '@job-pilot/db';
import { applications, outcomes, recruiterMessages } from '@job-pilot/db/schema';

import { getTenantContext } from '../lib/context.js';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

const router = Router();

// POST /api/activity/confirm
router.post('/confirm', async (req, res, next) => {
  try {
    const ctx = getTenantContext();
    const { action, itemId, itemType, data } = req.body;
    // action: 'confirm_status' | 'dismiss' | 'add_application'

    if (action === 'dismiss' && itemType === 'email') {
      await db
        .update(recruiterMessages)
        .set({ parsed: true })
        .where(and(eq(recruiterMessages.id, itemId), eq(recruiterMessages.tenantId, ctx.tenantId)));
      res.json({ success: true });
      return;
    }

    if (action === 'confirm_status' && data?.applicationId && data?.newStatus) {
      const now = new Date();
      const updates: any = { status: data.newStatus, lastActivityAt: now, updatedAt: now };
      if (data.newStatus === 'rejected') updates.rejectedAt = now;

      const [updated] = await db
        .update(applications)
        .set(updates)
        .where(
          and(eq(applications.id, data.applicationId), eq(applications.tenantId, ctx.tenantId)),
        )
        .returning();

      if (updated) {
        await db.insert(outcomes).values({
          id: createId(),
          applicationId: data.applicationId,
          stage: data.newStatus,
          notes: data.reason || 'Confirmed from activity feed',
        });
      }

      // Mark email as processed if applicable
      if (itemId && itemType === 'email') {
        await db
          .update(recruiterMessages)
          .set({ parsed: true, applicationId: data.applicationId })
          .where(eq(recruiterMessages.id, itemId));
      }

      res.json({ success: true, application: updated });
      return;
    }

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
