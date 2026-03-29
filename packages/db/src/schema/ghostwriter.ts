import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { createId } from '../utils.js';
import { tenants } from './tenants.js';
import { candidates } from './candidates.js';
import { jobs } from './jobs.js';

export const ghostwriterMessages = pgTable('ghostwriter_messages', {
  id: text('id').primaryKey().$defaultFn(createId),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  candidateId: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  context: varchar('context', { length: 30 }), // null = ghostwriter, 'resume_interview' = resume depth interview
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('ghostwriter_messages_tenant_id_job_id_idx').on(table.tenantId, table.jobId),
  index('gw_messages_context_idx').on(table.tenantId, table.jobId, table.context),
]);
