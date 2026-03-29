import { boolean, index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createId } from '../utils.js';
import { tenants, users } from './tenants.js';

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 30 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    message: text('message').notNull(),
    link: text('link'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_tenant_user_idx').on(table.tenantId, table.userId),
    index('notifications_user_read_idx').on(table.userId, table.read),
    index('notifications_created_at_idx').on(table.createdAt),
  ],
);
