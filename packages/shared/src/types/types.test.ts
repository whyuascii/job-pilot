import { describe, expect, it } from 'vitest';

import type {
  CreateAnswerBankEntry as _CreateAnswerBankEntry,
  CreateApplication as _CreateApplication,
  CreateCandidate as _CreateCandidate,
  CreateExperienceBlock as _CreateExperienceBlock,
  CreateJob as _CreateJob,
  CreateJobSource as _CreateJobSource,
  CreatePreference as _CreatePreference,
  CreateProject as _CreateProject,
  CreateSkill as _CreateSkill,
  CreateUser as _CreateUser,
  CreateTenant,
} from '../validators/index';
/**
 * Compile-time type assertions.
 *
 * These use TypeScript's type system to ensure that types are exported.
 * If a type were removed or renamed, this file would fail to compile.
 * At runtime these are no-ops.
 */
import type {
  AnswerBankEntry as _AnswerBankEntry,
  Application as _Application,
  ApplicationQuestion as _ApplicationQuestion,
  Candidate as _Candidate,
  ExperienceBlock as _ExperienceBlock,
  Job as _Job,
  JobScore as _JobScore,
  JobSource as _JobSource,
  LlmRun as _LlmRun,
  Outcome as _Outcome,
  Preference as _Preference,
  Project as _Project,
  Resume as _Resume,
  Skill as _Skill,
  User as _User,
  ApiSourceConfig,
  ApplicationStatus,
  CompetitivenessBreakdown,
  FirecrawlSourceConfig,
  FitBreakdown,
  JobSourceConfig,
  RssSourceConfig,
  Tenant,
  TenantId,
  UserId,
} from './index';

/**
 * Type export tests: verify that all expected types and interfaces are
 * properly exported from the types module and the top-level package entry.
 *
 * These tests serve as a contract check: if an export is accidentally
 * removed or renamed, the corresponding test will fail at compile time
 * (TypeScript) and at runtime (the import will be undefined).
 */

describe('type exports from types/index', () => {
  it('exports all expected type aliases and interfaces', async () => {
    const types = await import('./index');

    // We cannot check TypeScript-only exports at runtime because they are
    // erased after compilation. Instead, we verify that the module loads
    // without error. The compile-time check below provides the real safety
    // net: if any of these types were removed, this file would fail to
    // type-check.

    // This import test verifies the module is loadable
    expect(types).toBeDefined();
  });
});

describe('validator type re-exports from validators/index', () => {
  it('exports all inferred types alongside their schemas', async () => {
    const validators = await import('../validators/index');

    // Verify schemas are exported (runtime check)
    expect(validators.tenantSchema).toBeDefined();
    expect(validators.userSchema).toBeDefined();
    expect(validators.candidateSchema).toBeDefined();
    expect(validators.skillSchema).toBeDefined();
    expect(validators.experienceBlockSchema).toBeDefined();
    expect(validators.projectSchema).toBeDefined();
    expect(validators.jobSchema).toBeDefined();
    expect(validators.applicationSchema).toBeDefined();
    expect(validators.applicationStatusSchema).toBeDefined();
    expect(validators.answerBankSchema).toBeDefined();
    expect(validators.jobSourceSchema).toBeDefined();
    expect(validators.jobSourceConfigSchema).toBeDefined();
    expect(validators.preferenceSchema).toBeDefined();
  });
});

describe('top-level package exports', () => {
  it('re-exports types module', async () => {
    const pkg = await import('../index');
    expect(pkg).toBeDefined();
  });

  it('re-exports validators module', async () => {
    const pkg = await import('../index');
    expect(pkg.tenantSchema).toBeDefined();
    expect(pkg.userSchema).toBeDefined();
    expect(pkg.candidateSchema).toBeDefined();
    expect(pkg.skillSchema).toBeDefined();
    expect(pkg.experienceBlockSchema).toBeDefined();
    expect(pkg.projectSchema).toBeDefined();
    expect(pkg.jobSchema).toBeDefined();
    expect(pkg.applicationSchema).toBeDefined();
    expect(pkg.applicationStatusSchema).toBeDefined();
    expect(pkg.answerBankSchema).toBeDefined();
    expect(pkg.jobSourceSchema).toBeDefined();
    expect(pkg.jobSourceConfigSchema).toBeDefined();
    expect(pkg.preferenceSchema).toBeDefined();
  });

  it('re-exports env utilities', async () => {
    const pkg = await import('../index');
    expect(pkg.validateEnv).toBeDefined();
    expect(typeof pkg.validateEnv).toBe('function');
    expect(pkg.getEnv).toBeDefined();
    expect(typeof pkg.getEnv).toBe('function');
  });

  it('re-exports logger utilities', async () => {
    const pkg = await import('../index');
    expect(pkg.logger).toBeDefined();
    expect(pkg.createLogger).toBeDefined();
    expect(typeof pkg.createLogger).toBe('function');
  });
});

// Ensure the imported types are usable (compile-time only)
describe('compile-time type checks', () => {
  it('TenantId and UserId are string aliases', () => {
    const tid: TenantId = 'tenant_abc';
    const uid: UserId = 'user_xyz';
    expect(typeof tid).toBe('string');
    expect(typeof uid).toBe('string');
  });

  it('Tenant interface has expected shape', () => {
    const tenant: Tenant = {
      id: 'tid',
      name: 'Acme',
      slug: 'acme',
      plan: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(tenant.id).toBe('tid');
    expect(tenant.plan).toBe('free');
  });

  it('ApplicationStatus union contains expected values', () => {
    const statuses: ApplicationStatus[] = [
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
    ];
    expect(statuses).toHaveLength(11);
  });

  it('JobScore has both breakdown types', () => {
    const fit: FitBreakdown = {
      titleMatch: 80,
      compensationFit: 90,
      locationFit: 70,
      stackOverlap: 85,
      seniorityFit: 75,
      industryFit: 60,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 90,
      experienceDepth: 80,
      domainRelevance: 70,
      leadershipMatch: 60,
      adjacentSkills: 75,
      gapPenalty: 85,
    };
    expect(fit.titleMatch).toBe(80);
    expect(comp.requiredSkillsOverlap).toBe(90);
  });

  it('JobSourceConfig union includes all variants', () => {
    const firecrawl: FirecrawlSourceConfig = { baseUrl: 'https://example.com' };
    const api: ApiSourceConfig = { endpoint: 'https://api.example.com' };
    const rss: RssSourceConfig = { feedUrl: 'https://example.com/feed' };
    const manual: JobSourceConfig = {};

    expect(firecrawl.baseUrl).toBeDefined();
    expect(api.endpoint).toBeDefined();
    expect(rss.feedUrl).toBeDefined();
    expect(manual).toBeDefined();
  });

  it('CreateTenant inferred type works with valid data', () => {
    const data: CreateTenant = { name: 'Acme', slug: 'acme', plan: 'free' };
    expect(data.name).toBe('Acme');
  });
});
