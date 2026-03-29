import { describe, expect, it } from 'vitest';

import {
  answerBankSchema,
  applicationSchema,
  applicationStatusSchema,
  candidateSchema,
  experienceBlockSchema,
  jobSchema,
  jobSourceConfigSchema,
  jobSourceSchema,
  preferenceSchema,
  projectSchema,
  skillSchema,
  tenantSchema,
  userSchema,
} from './index';

// ---------------------------------------------------------------------------
// Edge cases: boundary values, empty strings, special characters,
// SQL injection attempts, Unicode, and malformed inputs
// ---------------------------------------------------------------------------

describe('tenantSchema edge cases', () => {
  it('accepts name at exact max length (100 chars)', () => {
    const result = tenantSchema.safeParse({ name: 'a'.repeat(100), slug: 'valid' });
    expect(result.success).toBe(true);
  });

  it('rejects name exceeding max length (101 chars)', () => {
    const result = tenantSchema.safeParse({ name: 'a'.repeat(101), slug: 'valid' });
    expect(result.success).toBe(false);
  });

  it('accepts single character name', () => {
    const result = tenantSchema.safeParse({ name: 'A', slug: 'a' });
    expect(result.success).toBe(true);
  });

  it('accepts slug at exact max length (50 chars)', () => {
    const result = tenantSchema.safeParse({ name: 'Test', slug: 'a'.repeat(50) });
    expect(result.success).toBe(true);
  });

  it('rejects slug exceeding max length (51 chars)', () => {
    const result = tenantSchema.safeParse({ name: 'Test', slug: 'a'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('rejects slug with uppercase letters', () => {
    const result = tenantSchema.safeParse({ name: 'Test', slug: 'UPPER' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with spaces', () => {
    const result = tenantSchema.safeParse({ name: 'Test', slug: 'has space' });
    expect(result.success).toBe(false);
  });

  it('rejects slug with underscores', () => {
    const result = tenantSchema.safeParse({ name: 'Test', slug: 'has_underscore' });
    expect(result.success).toBe(false);
  });

  it('accepts slug with numbers and hyphens', () => {
    const result = tenantSchema.safeParse({ name: 'Test', slug: 'my-org-123' });
    expect(result.success).toBe(true);
  });

  it('rejects SQL injection in name field', () => {
    // SQL injection strings should be accepted as strings (no DB concern at validation layer)
    // but the validator only checks min/max length
    const result = tenantSchema.safeParse({
      name: "'; DROP TABLE tenants; --",
      slug: 'safe-slug',
    });
    expect(result.success).toBe(true);
  });

  it('rejects SQL injection in slug field (invalid chars)', () => {
    const result = tenantSchema.safeParse({
      name: 'Safe Name',
      slug: "'; DROP TABLE tenants; --",
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid plan values', () => {
    for (const plan of ['free', 'pro', 'enterprise'] as const) {
      const result = tenantSchema.safeParse({ name: 'Test', slug: 'test', plan });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid plan value', () => {
    const result = tenantSchema.safeParse({ name: 'Test', slug: 'test', plan: 'premium' });
    expect(result.success).toBe(false);
  });

  it('handles unicode characters in name', () => {
    const result = tenantSchema.safeParse({ name: 'Acme Corp \u00e9\u00e8\u00ea', slug: 'acme' });
    expect(result.success).toBe(true);
  });

  it('handles emoji in name', () => {
    const result = tenantSchema.safeParse({ name: 'Rocket Co \ud83d\ude80', slug: 'rocket' });
    expect(result.success).toBe(true);
  });
});

describe('userSchema edge cases', () => {
  it('rejects email without domain', () => {
    const result = userSchema.safeParse({ email: 'user@', name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('rejects email without @ symbol', () => {
    const result = userSchema.safeParse({ email: 'user.example.com', name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('rejects email with spaces', () => {
    const result = userSchema.safeParse({ email: 'user @example.com', name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('accepts email with plus addressing', () => {
    const result = userSchema.safeParse({ email: 'user+tag@example.com', name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('accepts email with subdomain', () => {
    const result = userSchema.safeParse({ email: 'user@mail.example.com', name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = userSchema.safeParse({ email: 'test@example.com', name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts name at max length (100 chars)', () => {
    const result = userSchema.safeParse({ email: 'test@example.com', name: 'a'.repeat(100) });
    expect(result.success).toBe(true);
  });

  it('rejects name exceeding max length (101 chars)', () => {
    const result = userSchema.safeParse({ email: 'test@example.com', name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('accepts both valid role values', () => {
    for (const role of ['admin', 'member'] as const) {
      const result = userSchema.safeParse({ email: 'test@example.com', name: 'Test', role });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = userSchema.safeParse({
      email: 'test@example.com',
      name: 'Test',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });

  it('passes SQL injection through email field if format is valid', () => {
    // Zod email validation checks format, not content safety.
    // SQL injection is prevented at the query/ORM layer, not the validator.
    const result = userSchema.safeParse({
      email: "admin'--@example.com",
      name: 'Hacker',
    });
    // Zod considers this a valid email format
    expect(result.success).toBe(true);
  });

  it('rejects SQL injection that breaks email format', () => {
    const result = userSchema.safeParse({
      email: "'; DROP TABLE users; --",
      name: 'Hacker',
    });
    expect(result.success).toBe(false);
  });
});

describe('candidateSchema edge cases', () => {
  const baseCandidate = {
    headline: 'Engineer',
    yearsOfExperience: 5,
    currentTitle: 'Dev',
    location: 'NYC',
    remotePreference: 'remote' as const,
  };

  it('accepts exactly 0 years of experience', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, yearsOfExperience: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts exactly 50 years of experience', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, yearsOfExperience: 50 });
    expect(result.success).toBe(true);
  });

  it('rejects fractional years of experience', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, yearsOfExperience: 5.5 });
    expect(result.success).toBe(false);
  });

  it('rejects negative years of experience', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, yearsOfExperience: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts headline at max length (200 chars)', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, headline: 'x'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('rejects headline exceeding max length (201 chars)', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, headline: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('accepts summary at max length (5000 chars)', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, summary: 'x'.repeat(5000) });
    expect(result.success).toBe(true);
  });

  it('rejects summary exceeding max length (5001 chars)', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, summary: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('accepts all valid remotePreference values', () => {
    for (const pref of ['remote', 'hybrid', 'onsite', 'flexible'] as const) {
      const result = candidateSchema.safeParse({ ...baseCandidate, remotePreference: pref });
      expect(result.success).toBe(true);
    }
  });

  it('accepts positive salaryMin', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, salaryMin: 50000 });
    expect(result.success).toBe(true);
  });

  it('rejects zero salaryMin', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, salaryMin: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative salaryMin', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, salaryMin: -1000 });
    expect(result.success).toBe(false);
  });

  it('accepts null salaryMin', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, salaryMin: null });
    expect(result.success).toBe(true);
  });

  it('requires exactly 3-char salaryCurrency', () => {
    const valid = candidateSchema.safeParse({ ...baseCandidate, salaryCurrency: 'EUR' });
    expect(valid.success).toBe(true);

    const tooShort = candidateSchema.safeParse({ ...baseCandidate, salaryCurrency: 'US' });
    expect(tooShort.success).toBe(false);

    const tooLong = candidateSchema.safeParse({ ...baseCandidate, salaryCurrency: 'USDX' });
    expect(tooLong.success).toBe(false);
  });

  it('defaults visaRequired to false', () => {
    const result = candidateSchema.parse(baseCandidate);
    expect(result.visaRequired).toBe(false);
  });

  it('accepts visaRequired as true', () => {
    const result = candidateSchema.safeParse({ ...baseCandidate, visaRequired: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visaRequired).toBe(true);
    }
  });

  it('handles special characters in headline', () => {
    const result = candidateSchema.safeParse({
      ...baseCandidate,
      headline: 'Sr. Engineer (Full-Stack) @ Google & Co.',
    });
    expect(result.success).toBe(true);
  });
});

describe('skillSchema edge cases', () => {
  it('accepts confidence score of exactly 0', () => {
    const result = skillSchema.safeParse({ name: 'Test', category: 'tool', confidenceScore: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts confidence score of exactly 100', () => {
    const result = skillSchema.safeParse({ name: 'Test', category: 'tool', confidenceScore: 100 });
    expect(result.success).toBe(true);
  });

  it('accepts fractional confidence score', () => {
    const result = skillSchema.safeParse({ name: 'Test', category: 'tool', confidenceScore: 85.5 });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = skillSchema.safeParse({ name: '', category: 'tool', confidenceScore: 50 });
    expect(result.success).toBe(false);
  });

  it('accepts name at max length (100 chars)', () => {
    const result = skillSchema.safeParse({
      name: 'x'.repeat(100),
      category: 'tool',
      confidenceScore: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects name exceeding max length (101 chars)', () => {
    const result = skillSchema.safeParse({
      name: 'x'.repeat(101),
      category: 'tool',
      confidenceScore: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = skillSchema.safeParse({
      name: 'Test',
      category: 'unknown',
      confidenceScore: 50,
    });
    expect(result.success).toBe(false);
  });

  it('accepts null yearsUsed', () => {
    const result = skillSchema.safeParse({
      name: 'Test',
      category: 'tool',
      confidenceScore: 50,
      yearsUsed: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts zero yearsUsed', () => {
    const result = skillSchema.safeParse({
      name: 'Test',
      category: 'tool',
      confidenceScore: 50,
      yearsUsed: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative yearsUsed', () => {
    const result = skillSchema.safeParse({
      name: 'Test',
      category: 'tool',
      confidenceScore: 50,
      yearsUsed: -1,
    });
    expect(result.success).toBe(false);
  });

  it('coerces lastUsed from string to Date', () => {
    const result = skillSchema.parse({
      name: 'Test',
      category: 'tool',
      confidenceScore: 50,
      lastUsed: '2023-06-15',
    });
    expect(result.lastUsed).toBeInstanceOf(Date);
  });

  it('defaults yearsUsed to null', () => {
    const result = skillSchema.parse({ name: 'Test', category: 'tool', confidenceScore: 50 });
    expect(result.yearsUsed).toBeNull();
  });

  it('defaults lastUsed to null', () => {
    const result = skillSchema.parse({ name: 'Test', category: 'tool', confidenceScore: 50 });
    expect(result.lastUsed).toBeNull();
  });

  it('handles skill names with special characters', () => {
    const names = ['C++', 'C#', 'ASP.NET', 'Node.js', 'Vue.js', 'Objective-C'];
    for (const name of names) {
      const result = skillSchema.safeParse({ name, category: 'language', confidenceScore: 75 });
      expect(result.success).toBe(true);
    }
  });
});

describe('experienceBlockSchema edge cases', () => {
  const base = { company: 'Google', title: 'Engineer', startDate: '2020-01-01' };

  it('rejects empty company', () => {
    const result = experienceBlockSchema.safeParse({ ...base, company: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = experienceBlockSchema.safeParse({ ...base, title: '' });
    expect(result.success).toBe(false);
  });

  it('accepts company at max length (200 chars)', () => {
    const result = experienceBlockSchema.safeParse({ ...base, company: 'x'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('rejects company exceeding max length (201 chars)', () => {
    const result = experienceBlockSchema.safeParse({ ...base, company: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('defaults location to empty string', () => {
    const result = experienceBlockSchema.parse(base);
    expect(result.location).toBe('');
  });

  it('defaults current to false', () => {
    const result = experienceBlockSchema.parse(base);
    expect(result.current).toBe(false);
  });

  it('defaults description to empty string', () => {
    const result = experienceBlockSchema.parse(base);
    expect(result.description).toBe('');
  });

  it('accepts endDate as null', () => {
    const result = experienceBlockSchema.safeParse({ ...base, endDate: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endDate).toBeNull();
    }
  });

  it('coerces endDate string to Date', () => {
    const result = experienceBlockSchema.parse({ ...base, endDate: '2023-12-31' });
    expect(result.endDate).toBeInstanceOf(Date);
  });

  it('accepts bullets with max length entries', () => {
    const result = experienceBlockSchema.safeParse({
      ...base,
      bullets: ['x'.repeat(500)],
    });
    expect(result.success).toBe(true);
  });

  it('rejects bullet exceeding max length (501 chars)', () => {
    const result = experienceBlockSchema.safeParse({
      ...base,
      bullets: ['x'.repeat(501)],
    });
    expect(result.success).toBe(false);
  });

  it('accepts description at max length (5000 chars)', () => {
    const result = experienceBlockSchema.safeParse({ ...base, description: 'x'.repeat(5000) });
    expect(result.success).toBe(true);
  });

  it('rejects description exceeding max length (5001 chars)', () => {
    const result = experienceBlockSchema.safeParse({ ...base, description: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe('projectSchema edge cases', () => {
  const base = { name: 'My Project', description: 'A cool project' };

  it('rejects empty name', () => {
    const result = projectSchema.safeParse({ ...base, name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts name at max length (200 chars)', () => {
    const result = projectSchema.safeParse({ ...base, name: 'x'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('rejects name exceeding max length (201 chars)', () => {
    const result = projectSchema.safeParse({ ...base, name: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('defaults url to null', () => {
    const result = projectSchema.parse(base);
    expect(result.url).toBeNull();
  });

  it('accepts valid URL', () => {
    const result = projectSchema.safeParse({ ...base, url: 'https://github.com/user/project' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = projectSchema.safeParse({ ...base, url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('defaults skills to empty array', () => {
    const result = projectSchema.parse(base);
    expect(result.skills).toEqual([]);
  });

  it('defaults highlights to empty array', () => {
    const result = projectSchema.parse(base);
    expect(result.highlights).toEqual([]);
  });

  it('rejects highlight exceeding max length (501 chars)', () => {
    const result = projectSchema.safeParse({ ...base, highlights: ['x'.repeat(501)] });
    expect(result.success).toBe(false);
  });

  it('accepts description at max length (5000 chars)', () => {
    const result = projectSchema.safeParse({ ...base, description: 'x'.repeat(5000) });
    expect(result.success).toBe(true);
  });

  it('rejects description exceeding max length (5001 chars)', () => {
    const result = projectSchema.safeParse({ ...base, description: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe('jobSchema edge cases', () => {
  const validJob = {
    company: 'Acme',
    title: 'Engineer',
    location: 'Remote',
    applyUrl: 'https://example.com/apply',
    sourceUrl: 'https://example.com/job',
    rawDescription: 'Build things',
  };

  it('rejects empty title', () => {
    const result = jobSchema.safeParse({ ...validJob, title: '' });
    expect(result.success).toBe(false);
  });

  it('accepts title at max length (200 chars)', () => {
    const result = jobSchema.safeParse({ ...validJob, title: 'x'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('rejects title exceeding max length (201 chars)', () => {
    const result = jobSchema.safeParse({ ...validJob, title: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('accepts all valid remotePolicy values', () => {
    for (const policy of ['remote', 'hybrid', 'onsite', 'unknown'] as const) {
      const result = jobSchema.safeParse({ ...validJob, remotePolicy: policy });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid remotePolicy', () => {
    const result = jobSchema.safeParse({ ...validJob, remotePolicy: 'anywhere' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid compensationType values', () => {
    for (const ct of ['salary', 'hourly', 'contract', 'unknown'] as const) {
      const result = jobSchema.safeParse({ ...validJob, compensationType: ct });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid employmentType values', () => {
    for (const et of ['full_time', 'part_time', 'contract', 'internship'] as const) {
      const result = jobSchema.safeParse({ ...validJob, employmentType: et });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid sponsorship values', () => {
    for (const sp of ['yes', 'no', 'unknown'] as const) {
      const result = jobSchema.safeParse({ ...validJob, sponsorship: sp });
      expect(result.success).toBe(true);
    }
  });

  it('rejects negative compensationMin', () => {
    const result = jobSchema.safeParse({ ...validJob, compensationMin: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects zero compensationMin', () => {
    const result = jobSchema.safeParse({ ...validJob, compensationMin: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts positive compensationMin', () => {
    const result = jobSchema.safeParse({ ...validJob, compensationMin: 100000 });
    expect(result.success).toBe(true);
  });

  it('defaults compensationMin to null', () => {
    const result = jobSchema.parse(validJob);
    expect(result.compensationMin).toBeNull();
  });

  it('defaults compensationCurrency to null', () => {
    const result = jobSchema.parse(validJob);
    expect(result.compensationCurrency).toBeNull();
  });

  it('accepts rawDescription at large size', () => {
    const result = jobSchema.safeParse({ ...validJob, rawDescription: 'x'.repeat(100000) });
    expect(result.success).toBe(true);
  });

  it('rejects rawDescription exceeding max (100001 chars)', () => {
    const result = jobSchema.safeParse({ ...validJob, rawDescription: 'x'.repeat(100001) });
    expect(result.success).toBe(false);
  });

  it('defaults parsedDescription to empty string', () => {
    const result = jobSchema.parse(validJob);
    expect(result.parsedDescription).toBe('');
  });

  it('defaults domain to null', () => {
    const result = jobSchema.parse(validJob);
    expect(result.domain).toBeNull();
  });

  it('accepts null yearsRequired', () => {
    const result = jobSchema.safeParse({ ...validJob, yearsRequired: null });
    expect(result.success).toBe(true);
  });

  it('rejects negative yearsRequired', () => {
    const result = jobSchema.safeParse({ ...validJob, yearsRequired: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts yearsRequired of 0', () => {
    const result = jobSchema.safeParse({ ...validJob, yearsRequired: 0 });
    expect(result.success).toBe(true);
  });

  it('handles SQL injection attempt in company', () => {
    const result = jobSchema.safeParse({
      ...validJob,
      company: "'; DROP TABLE jobs; --",
    });
    // Validator only checks length/format, not content safety
    expect(result.success).toBe(true);
  });

  it('handles XSS attempt in rawDescription', () => {
    const result = jobSchema.safeParse({
      ...validJob,
      rawDescription: '<script>alert("xss")</script><img src=x onerror=alert(1)>',
    });
    // Validator does not strip HTML; that is sanitizeText's job
    expect(result.success).toBe(true);
  });
});

describe('applicationSchema edge cases', () => {
  it('rejects missing jobId', () => {
    const result = applicationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses via applicationSchema', () => {
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
    for (const status of statuses) {
      const result = applicationSchema.safeParse({ jobId: 'job_1', status });
      expect(result.success).toBe(true);
    }
  });

  it('defaults notes to empty string', () => {
    const result = applicationSchema.parse({ jobId: 'job_1' });
    expect(result.notes).toBe('');
  });

  it('accepts notes at max length (5000 chars)', () => {
    const result = applicationSchema.safeParse({ jobId: 'job_1', notes: 'x'.repeat(5000) });
    expect(result.success).toBe(true);
  });

  it('rejects notes exceeding max length (5001 chars)', () => {
    const result = applicationSchema.safeParse({ jobId: 'job_1', notes: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('accepts jobId with special characters (no format constraint beyond min)', () => {
    const result = applicationSchema.safeParse({ jobId: 'abc_123xyz' });
    expect(result.success).toBe(true);
  });
});

describe('applicationStatusSchema edge cases', () => {
  it('rejects null', () => {
    const result = applicationStatusSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = applicationStatusSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects number', () => {
    const result = applicationStatusSchema.safeParse(1);
    expect(result.success).toBe(false);
  });

  it('rejects status with different casing', () => {
    const result = applicationStatusSchema.safeParse('Discovered');
    expect(result.success).toBe(false);
  });

  it('rejects status with trailing space', () => {
    const result = applicationStatusSchema.safeParse('discovered ');
    expect(result.success).toBe(false);
  });
});

describe('answerBankSchema edge cases', () => {
  const base = { questionPattern: 'Why here?', category: 'motivational', answer: 'Because...' };

  it('rejects empty questionPattern', () => {
    const result = answerBankSchema.safeParse({ ...base, questionPattern: '' });
    expect(result.success).toBe(false);
  });

  it('accepts questionPattern at max length (500 chars)', () => {
    const result = answerBankSchema.safeParse({ ...base, questionPattern: 'x'.repeat(500) });
    expect(result.success).toBe(true);
  });

  it('rejects questionPattern exceeding max length (501 chars)', () => {
    const result = answerBankSchema.safeParse({ ...base, questionPattern: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts answer at max length (10000 chars)', () => {
    const result = answerBankSchema.safeParse({ ...base, answer: 'x'.repeat(10000) });
    expect(result.success).toBe(true);
  });

  it('rejects answer exceeding max length (10001 chars)', () => {
    const result = answerBankSchema.safeParse({ ...base, answer: 'x'.repeat(10001) });
    expect(result.success).toBe(false);
  });

  it('accepts context at max length (2000 chars)', () => {
    const result = answerBankSchema.safeParse({ ...base, context: 'x'.repeat(2000) });
    expect(result.success).toBe(true);
  });

  it('rejects context exceeding max length (2001 chars)', () => {
    const result = answerBankSchema.safeParse({ ...base, context: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('handles HTML injection in answer', () => {
    const result = answerBankSchema.safeParse({
      ...base,
      answer: '<script>alert("xss")</script>I am passionate...',
    });
    // Validator does not strip HTML; sanitization is a separate layer
    expect(result.success).toBe(true);
  });
});

describe('jobSourceSchema edge cases', () => {
  it('rejects empty name', () => {
    const result = jobSourceSchema.safeParse({ name: '', type: 'manual' });
    expect(result.success).toBe(false);
  });

  it('accepts name at max length (100 chars)', () => {
    const result = jobSourceSchema.safeParse({ name: 'x'.repeat(100), type: 'manual' });
    expect(result.success).toBe(true);
  });

  it('rejects name exceeding max length (101 chars)', () => {
    const result = jobSourceSchema.safeParse({ name: 'x'.repeat(101), type: 'manual' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = jobSourceSchema.safeParse({ name: 'Test', type: 'webhook' });
    expect(result.success).toBe(false);
  });

  it('defaults config to empty object', () => {
    const result = jobSourceSchema.parse({ name: 'Test', type: 'manual' });
    expect(result.config).toEqual({});
  });

  it('defaults enabled to true', () => {
    const result = jobSourceSchema.parse({ name: 'Test', type: 'manual' });
    expect(result.enabled).toBe(true);
  });

  it('accepts enabled as false', () => {
    const result = jobSourceSchema.safeParse({ name: 'Test', type: 'manual', enabled: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
    }
  });
});

describe('jobSourceConfigSchema edge cases', () => {
  it('accepts valid firecrawl config', () => {
    const result = jobSourceConfigSchema.safeParse({
      baseUrl: 'https://example.com',
      selectors: { title: '.job-title' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid api config', () => {
    const result = jobSourceConfigSchema.safeParse({
      endpoint: 'https://api.example.com/jobs',
      headers: { Authorization: 'Bearer token' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid rss config', () => {
    const result = jobSourceConfigSchema.safeParse({
      feedUrl: 'https://example.com/feed.xml',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (manual config)', () => {
    const result = jobSourceConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('preferenceSchema edge cases', () => {
  it('rejects empty key', () => {
    const result = preferenceSchema.safeParse({ key: '', value: 'test', category: 'other' });
    expect(result.success).toBe(false);
  });

  it('rejects empty value', () => {
    const result = preferenceSchema.safeParse({ key: 'test', value: '', category: 'other' });
    expect(result.success).toBe(false);
  });

  it('accepts key at max length (100 chars)', () => {
    const result = preferenceSchema.safeParse({
      key: 'x'.repeat(100),
      value: 'v',
      category: 'other',
    });
    expect(result.success).toBe(true);
  });

  it('rejects key exceeding max length (101 chars)', () => {
    const result = preferenceSchema.safeParse({
      key: 'x'.repeat(101),
      value: 'v',
      category: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('accepts value at max length (1000 chars)', () => {
    const result = preferenceSchema.safeParse({
      key: 'k',
      value: 'x'.repeat(1000),
      category: 'other',
    });
    expect(result.success).toBe(true);
  });

  it('rejects value exceeding max length (1001 chars)', () => {
    const result = preferenceSchema.safeParse({
      key: 'k',
      value: 'x'.repeat(1001),
      category: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('handles SQL injection in key', () => {
    const result = preferenceSchema.safeParse({
      key: "'; DROP TABLE preferences; --",
      value: 'value',
      category: 'other',
    });
    // Key is a free-form string so this is accepted
    expect(result.success).toBe(true);
  });

  it('handles unicode in value', () => {
    const result = preferenceSchema.safeParse({
      key: 'target_location',
      value: 'M\u00fcnchen, Deutschland',
      category: 'location',
    });
    expect(result.success).toBe(true);
  });
});
