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
import { tenants, users } from './tenants.js';

export const candidates = pgTable('candidates', {
  id: text('id').primaryKey().$defaultFn(createId),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  legalName: varchar('legal_name', { length: 200 }),
  preferredName: varchar('preferred_name', { length: 100 }),
  headline: varchar('headline', { length: 200 }).notNull(),
  summary: text('summary').notNull().default(''),
  yearsOfExperience: integer('years_of_experience').notNull().default(0),
  currentTitle: varchar('current_title', { length: 100 }).notNull(),
  currentCompany: varchar('current_company', { length: 100 }),
  location: varchar('location', { length: 200 }).notNull(),
  remotePreference: varchar('remote_preference', { length: 20 }).notNull().default('flexible'),
  salaryMin: integer('salary_min'),
  salaryMax: integer('salary_max'),
  salaryCurrency: varchar('salary_currency', { length: 3 }).notNull().default('USD'),
  visaRequired: boolean('visa_required').notNull().default(false),
  // Profile links
  linkedinUrl: varchar('linkedin_url', { length: 500 }),
  githubUrl: varchar('github_url', { length: 500 }),
  websiteUrl: varchar('website_url', { length: 500 }),
  portfolioUrl: varchar('portfolio_url', { length: 500 }),
  // Avoided companies
  avoidedCompanies: jsonb('avoided_companies').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const skills = pgTable(
  'skills',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    category: varchar('category', { length: 30 }).notNull(),
    confidenceScore: real('confidence_score').notNull().default(50),
    yearsUsed: real('years_used'),
    lastUsed: timestamp('last_used', { withTimezone: true }),
  },
  (table) => [index('skills_candidate_id_idx').on(table.candidateId)],
);

export const experienceBlocks = pgTable(
  'experience_blocks',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    company: varchar('company', { length: 200 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    location: varchar('location', { length: 200 }).notNull().default(''),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),
    current: boolean('current').notNull().default(false),
    description: text('description').notNull().default(''),
    bullets: jsonb('bullets').$type<string[]>().notNull().default([]),
    skills: jsonb('skills').$type<string[]>().notNull().default([]),
  },
  (table) => [index('experience_blocks_candidate_id_idx').on(table.candidateId)],
);

export const projects = pgTable('projects', {
  id: text('id').primaryKey().$defaultFn(createId),
  candidateId: text('candidate_id')
    .notNull()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull(),
  url: text('url'),
  skills: jsonb('skills').$type<string[]>().notNull().default([]),
  highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
});

export const resumes = pgTable(
  'resumes',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    candidateId: text('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    type: varchar('type', { length: 20 }).notNull().default('uploaded'),
    storageKey: text('storage_key').notNull(),
    parsedContent: jsonb('parsed_content'),
    isPreferred: boolean('is_preferred').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('resumes_candidate_id_tenant_id_idx').on(table.candidateId, table.tenantId)],
);

export const preferences = pgTable('preferences', {
  id: text('id').primaryKey().$defaultFn(createId),
  candidateId: text('candidate_id')
    .notNull()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 100 }).notNull(),
  value: text('value').notNull(),
  category: varchar('category', { length: 20 }).notNull(),
});
