import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.js';
import { runWithTenantContext } from '../lib/context.js';
import { db } from '@job-pilot/db';
import { sql } from 'drizzle-orm';

/**
 * Express middleware that wraps route handlers in AsyncLocalStorage.run()
 * so that getTenantContext() works inside route handlers.
 *
 * Also sets the Postgres session variable `app.tenant_id` so that
 * Row Level Security policies can enforce tenant isolation at the DB level
 * as defense-in-depth (even if app code forgets a WHERE clause).
 *
 * Must be used AFTER authMiddleware.
 */
export function tenantMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.tenantContext) {
    res.status(401).json({ error: 'No tenant context' });
    return;
  }

  runWithTenantContext(req.tenantContext, async () => {
    try {
      // Set Postgres session variable for RLS policies
      await db.execute(sql`SELECT set_config('app.tenant_id', ${req.tenantContext!.tenantId}, true)`);
      next();
    } catch (error) {
      next(error);
    }
  });
}
