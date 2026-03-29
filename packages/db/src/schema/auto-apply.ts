import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '../utils.js';
import { tenants } from './tenants.js';
import { candidates } from './candidates.js';
import { jobs } from './jobs.js';
import { applications } from './applications.js';

export const coverLetters = pgTable('cover_letters', {
  id: text('id').primaryKey().$defaultFn(createId),
  candidateId: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  contentHtml: text('content_html'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('cover_letters_tenant_id_job_id_idx').on(table.tenantId, table.jobId),
]);

export const flightRecords = pgTable('flight_records', {
  id: text('id').primaryKey().$defaultFn(createId),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  candidateId: text('candidate_id').notNull().references(() => candidates.id, { onDelete: 'cascade' }),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  resumeSnapshot: jsonb('resume_snapshot').notNull(),
  coverLetterSnapshot: text('cover_letter_snapshot'),
  jobSnapshot: jsonb('job_snapshot').notNull(),
  scoreSnapshot: jsonb('score_snapshot'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('flight_records_tenant_id_candidate_id_idx').on(table.tenantId, table.candidateId),
]);

