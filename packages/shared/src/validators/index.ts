import { z } from 'zod';

export const tenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
});

export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'member']).default('member'),
});

export const candidateSchema = z.object({
  headline: z.string().min(1).max(200),
  summary: z.string().max(5000).default(''),
  yearsOfExperience: z.number().int().min(0).max(50),
  currentTitle: z.string().min(1).max(100),
  currentCompany: z.string().max(100).nullable().default(null),
  location: z.string().min(1).max(200),
  remotePreference: z.enum(['remote', 'hybrid', 'onsite', 'flexible']),
  salaryMin: z.number().positive().nullable().default(null),
  salaryMax: z.number().positive().nullable().default(null),
  salaryCurrency: z.string().length(3).default('USD'),
  visaRequired: z.boolean().default(false),
});

export const skillSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['language', 'framework', 'tool', 'platform', 'methodology', 'soft_skill', 'domain']),
  confidenceScore: z.number().min(0).max(100),
  yearsUsed: z.number().min(0).nullable().default(null),
  lastUsed: z.coerce.date().nullable().default(null),
});

export const experienceBlockSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  location: z.string().max(200).default(''),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().default(null),
  current: z.boolean().default(false),
  description: z.string().max(5000).default(''),
  bullets: z.array(z.string().max(500)).default([]),
  skills: z.array(z.string().max(100)).default([]),
});

export const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  url: z.string().url().nullable().default(null),
  skills: z.array(z.string().max(100)).default([]),
  highlights: z.array(z.string().max(500)).default([]),
});

export const jobSchema = z.object({
  company: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  location: z.string().max(200),
  remotePolicy: z.enum(['remote', 'hybrid', 'onsite', 'unknown']).default('unknown'),
  compensationMin: z.number().positive().nullable().default(null),
  compensationMax: z.number().positive().nullable().default(null),
  compensationCurrency: z.string().length(3).nullable().default(null),
  compensationType: z.enum(['salary', 'hourly', 'contract', 'unknown']).default('unknown'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'internship']).default('full_time'),
  yearsRequired: z.number().int().min(0).nullable().default(null),
  mustHaveSkills: z.array(z.string()).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  domain: z.string().max(100).nullable().default(null),
  sponsorship: z.enum(['yes', 'no', 'unknown']).default('unknown'),
  applyUrl: z.string().url(),
  sourceUrl: z.string().url(),
  rawDescription: z.string().max(100000),
  parsedDescription: z.string().max(100000).default(''),
});

export const applicationStatusSchema = z.enum([
  'discovered',
  'shortlisted',
  'resume_generated',
  'applied',
  'recruiter_screen',
  'technical',
  'onsite',
  'final',
  'rejected',
  'offer',
  'withdrawn',
]);

export const applicationSchema = z.object({
  jobId: z.string().min(1),
  status: applicationStatusSchema.default('discovered'),
  notes: z.string().max(5000).default(''),
});

export const answerBankSchema = z.object({
  questionPattern: z.string().min(1).max(500),
  category: z.string().min(1).max(100),
  answer: z.string().min(1).max(10000),
  context: z.string().max(2000).nullable().default(null),
});

const firecrawlSourceConfig = z.object({
  baseUrl: z.string().url(),
  selectors: z.record(z.string()).default({}),
  schedule: z.string().max(100).optional(),
});

const apiSourceConfig = z.object({
  endpoint: z.string().url(),
  headers: z.record(z.string()).default({}),
  queryParams: z.record(z.string()).default({}),
});

const rssSourceConfig = z.object({
  feedUrl: z.string().url(),
});

const manualSourceConfig = z.object({});

export const jobSourceConfigSchema = z.union([
  firecrawlSourceConfig,
  apiSourceConfig,
  rssSourceConfig,
  manualSourceConfig,
]);

export const jobSourceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['api', 'rss', 'firecrawl', 'manual']),
  config: jobSourceConfigSchema.default({}),
  enabled: z.boolean().default(true),
});

export const preferenceSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(1000),
  category: z.enum(['location', 'salary', 'role', 'company', 'other']),
});

export const notificationTypeSchema = z.enum([
  'job_scored',
  'application_updated',
  'high_score_job',
  'answer_suggestion',
  'system',
]);

export const notificationSchema = z.object({
  type: notificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  link: z.string().max(2000).nullable().default(null),
});

export const markNotificationReadSchema = z.object({
  notificationId: z.string().min(1),
});

// Inferred types from validators
export type CreateTenant = z.infer<typeof tenantSchema>;
export type CreateUser = z.infer<typeof userSchema>;
export type CreateCandidate = z.infer<typeof candidateSchema>;
export type CreateSkill = z.infer<typeof skillSchema>;
export type CreateExperienceBlock = z.infer<typeof experienceBlockSchema>;
export type CreateProject = z.infer<typeof projectSchema>;
export type CreateJob = z.infer<typeof jobSchema>;
export type CreateApplication = z.infer<typeof applicationSchema>;
export type CreateAnswerBankEntry = z.infer<typeof answerBankSchema>;
export type CreateJobSource = z.infer<typeof jobSourceSchema>;
export type CreatePreference = z.infer<typeof preferenceSchema>;
export type CreateNotification = z.infer<typeof notificationSchema>;
export type MarkNotificationRead = z.infer<typeof markNotificationReadSchema>;
