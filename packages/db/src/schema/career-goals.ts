import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '../utils.js';
import { candidates } from './candidates.js';
import { jobs } from './jobs.js';
import { tenants } from './tenants.js';

export const careerGoals = pgTable(
  'career_goals',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    selectedForCoaching: boolean('selected_for_coaching').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('career_goals_tenant_id_idx').on(table.tenantId),
    index('career_goals_candidate_id_idx').on(table.candidateId),
  ],
);
