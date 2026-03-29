import { describe, expect, it } from 'vitest';

import {
  answerBankSchema,
  applicationSchema,
  applicationStatusSchema,
  candidateSchema,
  experienceBlockSchema,
  jobSchema,
  jobSourceSchema,
  preferenceSchema,
  skillSchema,
  tenantSchema,
  userSchema,
} from './index';

describe('tenantSchema', () => {
  it('accepts valid tenant', () => {
    const result = tenantSchema.safeParse({ name: 'Acme Corp', slug: 'acme-corp' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = tenantSchema.safeParse({ name: '', slug: 'acme' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid slug characters', () => {
    const result = tenantSchema.safeParse({ name: 'Acme', slug: 'Acme Corp!' });
    expect(result.success).toBe(false);
  });

  it('defaults plan to free', () => {
    const result = tenantSchema.parse({ name: 'Acme', slug: 'acme' });
    expect(result.plan).toBe('free');
  });
});

describe('userSchema', () => {
  it('accepts valid user', () => {
    const result = userSchema.safeParse({ email: 'test@example.com', name: 'Test User' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = userSchema.safeParse({ email: 'not-an-email', name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('defaults role to member', () => {
    const result = userSchema.parse({ email: 'test@example.com', name: 'Test' });
    expect(result.role).toBe('member');
  });
});

describe('candidateSchema', () => {
  const validCandidate = {
    headline: 'Senior Software Engineer',
    yearsOfExperience: 5,
    currentTitle: 'Software Engineer',
    location: 'San Francisco, CA',
    remotePreference: 'remote' as const,
  };

  it('accepts valid candidate', () => {
    const result = candidateSchema.safeParse(validCandidate);
    expect(result.success).toBe(true);
  });

  it('rejects negative years of experience', () => {
    const result = candidateSchema.safeParse({ ...validCandidate, yearsOfExperience: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects years > 50', () => {
    const result = candidateSchema.safeParse({ ...validCandidate, yearsOfExperience: 51 });
    expect(result.success).toBe(false);
  });

  it('defaults summary to empty string', () => {
    const result = candidateSchema.parse(validCandidate);
    expect(result.summary).toBe('');
  });

  it('defaults salaryCurrency to USD', () => {
    const result = candidateSchema.parse(validCandidate);
    expect(result.salaryCurrency).toBe('USD');
  });

  it('rejects invalid remotePreference', () => {
    const result = candidateSchema.safeParse({ ...validCandidate, remotePreference: 'anywhere' });
    expect(result.success).toBe(false);
  });
});

describe('skillSchema', () => {
  it('accepts valid skill', () => {
    const result = skillSchema.safeParse({
      name: 'TypeScript',
      category: 'language',
      confidenceScore: 85,
    });
    expect(result.success).toBe(true);
  });

  it('rejects confidence score > 100', () => {
    const result = skillSchema.safeParse({
      name: 'TypeScript',
      category: 'language',
      confidenceScore: 101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects confidence score < 0', () => {
    const result = skillSchema.safeParse({
      name: 'TypeScript',
      category: 'language',
      confidenceScore: -5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', () => {
    const categories = [
      'language',
      'framework',
      'tool',
      'platform',
      'methodology',
      'soft_skill',
      'domain',
    ];
    categories.forEach((category) => {
      const result = skillSchema.safeParse({ name: 'Test', category, confidenceScore: 50 });
      expect(result.success).toBe(true);
    });
  });
});

describe('experienceBlockSchema', () => {
  it('accepts valid experience', () => {
    const result = experienceBlockSchema.safeParse({
      company: 'Google',
      title: 'Software Engineer',
      startDate: '2020-01-01',
    });
    expect(result.success).toBe(true);
  });

  it('coerces date strings to Date objects', () => {
    const result = experienceBlockSchema.parse({
      company: 'Google',
      title: 'Software Engineer',
      startDate: '2020-01-01',
    });
    expect(result.startDate).toBeInstanceOf(Date);
  });

  it('defaults bullets and skills to empty arrays', () => {
    const result = experienceBlockSchema.parse({
      company: 'Google',
      title: 'Software Engineer',
      startDate: '2020-01-01',
    });
    expect(result.bullets).toEqual([]);
    expect(result.skills).toEqual([]);
  });
});

describe('jobSchema', () => {
  const validJob = {
    company: 'Acme Corp',
    title: 'Senior Engineer',
    location: 'Remote',
    applyUrl: 'https://example.com/apply',
    sourceUrl: 'https://example.com/job/123',
    rawDescription: 'Build cool things',
  };

  it('accepts valid job', () => {
    const result = jobSchema.safeParse(validJob);
    expect(result.success).toBe(true);
  });

  it('rejects invalid applyUrl', () => {
    const result = jobSchema.safeParse({ ...validJob, applyUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('defaults remotePolicy to unknown', () => {
    const result = jobSchema.parse(validJob);
    expect(result.remotePolicy).toBe('unknown');
  });

  it('defaults skills arrays to empty', () => {
    const result = jobSchema.parse(validJob);
    expect(result.mustHaveSkills).toEqual([]);
    expect(result.niceToHaveSkills).toEqual([]);
  });

  it('rejects empty company', () => {
    const result = jobSchema.safeParse({ ...validJob, company: '' });
    expect(result.success).toBe(false);
  });
});

describe('applicationStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const statuses = [
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
    statuses.forEach((status) => {
      expect(applicationStatusSchema.safeParse(status).success).toBe(true);
    });
  });

  it('rejects invalid status', () => {
    expect(applicationStatusSchema.safeParse('invalid').success).toBe(false);
  });
});

describe('applicationSchema', () => {
  it('accepts valid application', () => {
    const result = applicationSchema.safeParse({ jobId: 'job_123' });
    expect(result.success).toBe(true);
  });

  it('defaults status to discovered', () => {
    const result = applicationSchema.parse({ jobId: 'job_123' });
    expect(result.status).toBe('discovered');
  });

  it('rejects empty jobId', () => {
    const result = applicationSchema.safeParse({ jobId: '' });
    expect(result.success).toBe(false);
  });
});

describe('answerBankSchema', () => {
  it('accepts valid answer', () => {
    const result = answerBankSchema.safeParse({
      questionPattern: 'Why do you want to work here?',
      category: 'motivational',
      answer: 'I am passionate about the mission...',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty answer', () => {
    const result = answerBankSchema.safeParse({
      questionPattern: 'Why?',
      category: 'motivational',
      answer: '',
    });
    expect(result.success).toBe(false);
  });

  it('defaults context to null', () => {
    const result = answerBankSchema.parse({
      questionPattern: 'Test',
      category: 'technical',
      answer: 'My answer',
    });
    expect(result.context).toBeNull();
  });
});

describe('jobSourceSchema', () => {
  it('accepts valid source', () => {
    const result = jobSourceSchema.safeParse({
      name: 'LinkedIn',
      type: 'manual',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid types', () => {
    ['api', 'rss', 'firecrawl', 'manual'].forEach((type) => {
      const result = jobSourceSchema.safeParse({ name: 'Test', type });
      expect(result.success).toBe(true);
    });
  });

  it('defaults enabled to true', () => {
    const result = jobSourceSchema.parse({ name: 'Test', type: 'manual' });
    expect(result.enabled).toBe(true);
  });
});

describe('preferenceSchema', () => {
  it('accepts valid preference', () => {
    const result = preferenceSchema.safeParse({
      key: 'target_location',
      value: 'San Francisco',
      category: 'location',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid categories', () => {
    ['location', 'salary', 'role', 'company', 'other'].forEach((category) => {
      const result = preferenceSchema.safeParse({ key: 'test', value: 'val', category });
      expect(result.success).toBe(true);
    });
  });

  it('rejects invalid category', () => {
    const result = preferenceSchema.safeParse({ key: 'test', value: 'val', category: 'invalid' });
    expect(result.success).toBe(false);
  });
});
