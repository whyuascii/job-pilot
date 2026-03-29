import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { createId } from '../utils.js';
import { candidates, resumes } from './candidates.js';
import { jobs } from './jobs.js';
import { tenants } from './tenants.js';

export const applications = pgTable(
  'applications',
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
    status: varchar('status', { length: 30 }).notNull().default('discovered'),
    tailoredResumeId: text('tailored_resume_id').references(() => resumes.id, {
      onDelete: 'set null',
    }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    notes: text('notes').notNull().default(''),
    coverLetterId: text('cover_letter_id'),
    flightRecordId: text('flight_record_id'),
    compMin: integer('comp_min'),
    compMax: integer('comp_max'),
    equityDetails: text('equity_details'),
    compNotes: text('comp_notes'),
    subStatus: varchar('sub_status', { length: 30 }),
    statusNote: text('status_note'),
    declinedByUser: boolean('declined_by_user').notNull().default(false),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    source: varchar('source', { length: 50 }).notNull().default('job_pilot'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('applications_tenant_id_status_idx').on(table.tenantId, table.status),
    index('applications_candidate_id_idx').on(table.candidateId),
    index('applications_sub_status_idx').on(table.subStatus),
    index('applications_last_activity_idx').on(table.lastActivityAt),
    index('applications_source_idx').on(table.source),
  ],
);

export const applicationQuestions = pgTable('application_questions', {
  id: text('id').primaryKey().$defaultFn(createId),
  applicationId: text('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  suggestedAnswer: text('suggested_answer'),
  finalAnswer: text('final_answer'),
  confidence: varchar('confidence', { length: 10 }).notNull().default('low'),
  sourceEvidence: text('source_evidence'),
  approved: boolean('approved').notNull().default(false),
});

export const answerBank = pgTable(
  'answer_bank',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    questionPattern: text('question_pattern').notNull(),
    category: varchar('category', { length: 100 }).notNull(),
    answer: text('answer').notNull(),
    context: text('context'),
    timesUsed: integer('times_used').notNull().default(0),
    lastUsed: timestamp('last_used', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('answer_bank_tenant_id_category_idx').on(table.tenantId, table.category)],
);

export const tailoredResumes = pgTable('tailored_resumes', {
  id: text('id').primaryKey().$defaultFn(createId),
  candidateId: text('candidate_id')
    .notNull()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  contentJson: jsonb('content_json').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const outcomes = pgTable(
  'outcomes',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    stage: varchar('stage', { length: 30 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
    metadata: jsonb('metadata'),
  },
  (table) => [index('outcomes_application_id_idx').on(table.applicationId)],
);

export const recruiterMessages = pgTable('recruiter_messages', {
  id: text('id').primaryKey().$defaultFn(createId),
  applicationId: text('application_id').references(() => applications.id, { onDelete: 'set null' }),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  externalId: text('external_id'),
  from: varchar('from_address', { length: 255 }).notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  parsed: boolean('parsed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const llmRuns = pgTable('llm_runs', {
  id: text('id').primaryKey().$defaultFn(createId),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  model: varchar('model', { length: 100 }).notNull(),
  provider: varchar('provider', { length: 20 }).notNull(),
  purpose: varchar('purpose', { length: 100 }).notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  latencyMs: integer('latency_ms').notNull().default(0),
  cost: real('cost'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
