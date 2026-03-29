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
import { candidates } from './candidates.js';
import { tenants } from './tenants.js';

export const jobSources = pgTable('job_sources', {
  id: text('id').primaryKey().$defaultFn(createId),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  config: jsonb('config').notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').references(() => jobSources.id, { onDelete: 'set null' }),
    company: varchar('company', { length: 200 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    location: varchar('location', { length: 200 }).notNull().default(''),
    remotePolicy: varchar('remote_policy', { length: 20 }).notNull().default('unknown'),
    compensationMin: integer('compensation_min'),
    compensationMax: integer('compensation_max'),
    compensationCurrency: varchar('compensation_currency', { length: 3 }),
    compensationType: varchar('compensation_type', { length: 20 }).notNull().default('unknown'),
    employmentType: varchar('employment_type', { length: 20 }).notNull().default('full_time'),
    yearsRequired: integer('years_required'),
    mustHaveSkills: jsonb('must_have_skills').$type<string[]>().notNull().default([]),
    niceToHaveSkills: jsonb('nice_to_have_skills').$type<string[]>().notNull().default([]),
    domain: varchar('domain', { length: 100 }),
    sponsorship: varchar('sponsorship', { length: 10 }).notNull().default('unknown'),
    applyUrl: text('apply_url').notNull(),
    sourceUrl: text('source_url').notNull(),
    rawDescription: text('raw_description').notNull(),
    parsedDescription: text('parsed_description').notNull().default(''),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('jobs_tenant_id_idx').on(table.tenantId),
    index('jobs_created_at_idx').on(table.createdAt),
    index('jobs_tenant_id_created_at_idx').on(table.tenantId, table.createdAt),
  ],
);

export const jobScores = pgTable(
  'job_scores',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    fitScore: real('fit_score').notNull(),
    competitivenessScore: real('competitiveness_score').notNull(),
    overallScore: real('overall_score').notNull(),
    fitBreakdown: jsonb('fit_breakdown').notNull(),
    competitivenessBreakdown: jsonb('competitiveness_breakdown').notNull(),
    recommendation: varchar('recommendation', { length: 20 }).notNull(),
    reasoning: text('reasoning').notNull(),
    scoredAt: timestamp('scored_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('job_scores_job_id_idx').on(table.jobId),
    index('job_scores_overall_score_idx').on(table.overallScore),
    index('job_scores_candidate_id_idx').on(table.candidateId),
  ],
);
