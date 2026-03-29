import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { createId } from '../utils.js';
import { applications } from './applications.js';
import { candidates } from './candidates.js';
import { tenants } from './tenants.js';

export const sentEmails = pgTable(
  'sent_emails',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    applicationId: text('application_id').references(() => applications.id, {
      onDelete: 'set null',
    }),
    to: text('to').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    templateType: varchar('template_type', { length: 30 }), // 'introduction' | 'follow_up' | 'thank_you'
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('sent_emails_tenant_id_idx').on(table.tenantId),
    index('sent_emails_application_id_idx').on(table.applicationId),
  ],
);
