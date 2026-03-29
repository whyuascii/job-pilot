export type TenantId = string;
export type UserId = string;

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: UserId;
  tenantId: TenantId;
  email: string;
  name: string;
  role: 'admin' | 'member';
  createdAt: Date;
  updatedAt: Date;
}

export interface Candidate {
  id: string;
  userId: UserId;
  tenantId: TenantId;
  headline: string;
  summary: string;
  yearsOfExperience: number;
  currentTitle: string;
  currentCompany: string | null;
  location: string;
  remotePreference: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  visaRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  id: string;
  candidateId: string;
  name: string;
  category:
    | 'language'
    | 'framework'
    | 'tool'
    | 'platform'
    | 'methodology'
    | 'soft_skill'
    | 'domain';
  confidenceScore: number; // 0-100
  yearsUsed: number | null;
  lastUsed: Date | null;
}

export interface ExperienceBlock {
  id: string;
  candidateId: string;
  company: string;
  title: string;
  location: string;
  startDate: Date;
  endDate: Date | null;
  current: boolean;
  description: string;
  bullets: string[];
  skills: string[];
}

export interface Project {
  id: string;
  candidateId: string;
  name: string;
  description: string;
  url: string | null;
  skills: string[];
  highlights: string[];
}

export interface Resume {
  id: string;
  candidateId: string;
  tenantId: TenantId;
  name: string;
  type: 'uploaded' | 'generated' | 'tailored';
  storageKey: string;
  parsedContent: Record<string, unknown> | null;
  isPreferred: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Job {
  id: string;
  tenantId: TenantId;
  sourceId: string | null;
  company: string;
  title: string;
  location: string;
  remotePolicy: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  compensationMin: number | null;
  compensationMax: number | null;
  compensationCurrency: string | null;
  compensationType: 'salary' | 'hourly' | 'contract' | 'unknown';
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship';
  yearsRequired: number | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  domain: string | null;
  sponsorship: 'yes' | 'no' | 'unknown';
  applyUrl: string;
  sourceUrl: string;
  rawDescription: string;
  parsedDescription: string;
  postedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobScore {
  id: string;
  jobId: string;
  candidateId: string;
  fitScore: number; // 0-100: Should this user care?
  competitivenessScore: number; // 0-100: How strong is the candidate?
  overallScore: number; // weighted combination
  fitBreakdown: FitBreakdown;
  competitivenessBreakdown: CompetitivenessBreakdown;
  recommendation: 'strong_apply' | 'apply' | 'maybe' | 'skip';
  reasoning: string;
  scoredAt: Date;
}

export interface FitBreakdown {
  titleMatch: number;
  compensationFit: number;
  locationFit: number;
  stackOverlap: number;
  seniorityFit: number;
  industryFit: number;
}

export interface CompetitivenessBreakdown {
  requiredSkillsOverlap: number;
  experienceDepth: number;
  domainRelevance: number;
  leadershipMatch: number;
  adjacentSkills: number;
  gapPenalty: number;
}

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  tenantId: TenantId;
  status: ApplicationStatus;
  tailoredResumeId: string | null;
  appliedAt: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationStatus =
  | 'discovered'
  | 'shortlisted'
  | 'resume_generated'
  | 'applied'
  | 'recruiter_screen'
  | 'technical'
  | 'onsite'
  | 'final'
  | 'rejected'
  | 'offer'
  | 'withdrawn';

export interface ApplicationQuestion {
  id: string;
  applicationId: string;
  question: string;
  suggestedAnswer: string | null;
  finalAnswer: string | null;
  confidence: 'high' | 'medium' | 'low';
  sourceEvidence: string | null;
  approved: boolean;
}

export interface AnswerBankEntry {
  id: string;
  candidateId: string;
  tenantId: TenantId;
  questionPattern: string;
  category: string;
  answer: string;
  context: string | null;
  timesUsed: number;
  lastUsed: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FirecrawlSourceConfig = {
  baseUrl: string;
  selectors?: Record<string, string>;
  schedule?: string;
};
export type ApiSourceConfig = {
  endpoint: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
};
export type RssSourceConfig = { feedUrl: string };
export type JobSourceConfig =
  | FirecrawlSourceConfig
  | ApiSourceConfig
  | RssSourceConfig
  | Record<string, never>;

export interface JobSource {
  id: string;
  tenantId: TenantId;
  name: string;
  type: 'api' | 'rss' | 'firecrawl' | 'manual';
  config: JobSourceConfig;
  enabled: boolean;
  lastSyncAt: Date | null;
  createdAt: Date;
}

export interface LlmRun {
  id: string;
  tenantId: TenantId;
  model: string;
  provider: 'anthropic' | 'bedrock';
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cost: number | null;
  createdAt: Date;
}

export interface Outcome {
  id: string;
  applicationId: string;
  stage: ApplicationStatus;
  occurredAt: Date;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

export interface Preference {
  id: string;
  candidateId: string;
  key: string;
  value: string;
  category: 'location' | 'salary' | 'role' | 'company' | 'other';
}

export type NotificationType =
  | 'job_scored'
  | 'application_updated'
  | 'high_score_job'
  | 'answer_suggestion'
  | 'system';

export interface Notification {
  id: string;
  tenantId: TenantId;
  userId: UserId;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
}
