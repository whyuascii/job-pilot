import type { Request, Response, NextFunction } from 'express';
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

    const tenantId = (session.user as any).tenantId;
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
