import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { createId } from '../utils.js';
import { tenants, users } from './tenants.js';

export const gmailTokens = pgTable(
  'gmail_tokens',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    scope: text('scope').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('gmail_tokens_tenant_user_idx').on(table.tenantId, table.userId),
    index('gmail_tokens_user_id_idx').on(table.userId),
  ],
);
