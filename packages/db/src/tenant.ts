import { and, eq, SQL } from 'drizzle-orm';
import { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';

import { db } from './client.js';

export type TenantContext = {
  tenantId: string;
  userId: string;
};

/**
 * Creates a tenant-scoped where clause.
 * Use with any table that has a tenantId column.
 */
export function tenantWhere<T extends TableConfig>(
  table: PgTableWithColumns<T>,
  tenantId: string,
  ...conditions: SQL[]
) {
  const tenantCol = (table as any).tenantId;
  if (!tenantCol) {
    throw new Error(`Table does not have a tenantId column`);
  }
  if (conditions.length === 0) {
    return eq(tenantCol, tenantId);
  }
  return and(eq(tenantCol, tenantId), ...conditions)!;
}

/**
 * Helper to create a tenant-scoped query builder.
 * Wraps the db instance with automatic tenant filtering.
 */
export function createTenantDb(ctx: TenantContext) {
  return {
    ...ctx,
    db,
    where: <T extends TableConfig>(table: PgTableWithColumns<T>, ...conditions: SQL[]) =>
      tenantWhere(table, ctx.tenantId, ...conditions),
  };
}

export type TenantDb = ReturnType<typeof createTenantDb>;
