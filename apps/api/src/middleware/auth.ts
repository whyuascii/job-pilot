import { eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';

import { db } from '@job-pilot/db';
import { users } from '@job-pilot/db/schema';

import { auth } from '../lib/auth.js';

export interface AuthenticatedRequest extends Request {
  tenantContext?: {
    tenantId: string;
    userId: string;
  };
}

/**
 * Express middleware that extracts the session from cookies using better-auth.
 * Converts Express req.headers into a Web Headers object for better-auth compatibility.
 * Sets req.tenantContext on success, or returns 401 on failure.
 *
 * If tenantId is missing from the cached session (race condition during signup
 * where the databaseHook sets tenantId AFTER the session is created), we fall
 * back to reading the user row directly from the DB.
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Convert Express headers to Web Headers for better-auth
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let tenantId = (session.user as any).tenantId;

    // Fallback: session created during signup may not have tenantId yet
    // because the databaseHook runs AFTER the session is created.
    if (!tenantId) {
      const [row] = await db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);
      tenantId = row?.tenantId;
    }

    if (!tenantId) {
      res.status(403).json({ error: 'No tenant assigned to this user' });
      return;
    }

    req.tenantContext = {
      tenantId,
      userId: session.user.id,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}
