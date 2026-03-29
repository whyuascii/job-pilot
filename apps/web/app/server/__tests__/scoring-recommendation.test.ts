import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Tests for the scoring recommendation logic.
//
// The AI server (ai.ts) uses a SCORING_PROMPT that defines the recommendation
// thresholds. This file tests the recommendation classification logic:
//
// - "strong_apply": Both fit and competitiveness averages >= 75
// - "apply": Overall average >= 60
// - "maybe": Overall average >= 40
// - "skip": Overall average < 40
//
// Since the actual scoring is done by Claude AI, these tests verify that
// the classification function correctly maps scores to recommendations.
// ---------------------------------------------------------------------------

interface FitBreakdown {
  titleMatch: number;
  compensationFit: number;
  locationFit: number;
  stackOverlap: number;
  seniorityFit: number;
  industryFit: number;
}

interface CompetitivenessBreakdown {
  requiredSkillsOverlap: number;
  experienceDepth: number;
  domainRelevance: number;
  leadershipMatch: number;
  adjacentSkills: number;
  gapPenalty: number;
}

/** Calculate the average of a breakdown's dimension values. */
function averageBreakdown(breakdown: Record<string, number>): number {
  const values = Object.values(breakdown);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Classify a score result into a recommendation tier. */
function classifyRecommendation(
  fitBreakdown: FitBreakdown,
  competitivenessBreakdown: CompetitivenessBreakdown,
): 'strong_apply' | 'apply' | 'maybe' | 'skip' {
  const fitAvg = averageBreakdown(fitBreakdown);
  const compAvg = averageBreakdown(competitivenessBreakdown);
  const overall = (fitAvg + compAvg) / 2;

  if (fitAvg >= 75 && compAvg >= 75) return 'strong_apply';
  if (overall >= 60) return 'apply';
  if (overall >= 40) return 'maybe';
  return 'skip';
}

/** Calculate overall score as weighted combination. */
function calculateOverallScore(fitScore: number, competitivenessScore: number): number {
  // Typical weighting: 50/50 or fit-heavy
  return Math.round((fitScore + competitivenessScore) / 2);
}

describe('averageBreakdown', () => {
  it('calculates average of all dimensions', () => {
    const breakdown = { a: 80, b: 60, c: 100 };
    expect(averageBreakdown(breakdown)).toBe(80);
  });

  it('handles all zeroes', () => {
    const breakdown = { a: 0, b: 0, c: 0 };
    expect(averageBreakdown(breakdown)).toBe(0);
  });

  it('handles all 100s', () => {
    const breakdown = { a: 100, b: 100, c: 100 };
    expect(averageBreakdown(breakdown)).toBe(100);
  });

  it('handles single dimension', () => {
    expect(averageBreakdown({ x: 75 })).toBe(75);
  });
});

describe('classifyRecommendation', () => {
  it('returns strong_apply when both averages >= 75', () => {
    const fit: FitBreakdown = {
      titleMatch: 80,
      compensationFit: 80,
      locationFit: 80,
      stackOverlap: 80,
      seniorityFit: 80,
      industryFit: 80,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 80,
      experienceDepth: 80,
      domainRelevance: 80,
      leadershipMatch: 80,
      adjacentSkills: 80,
      gapPenalty: 80,
    };
    expect(classifyRecommendation(fit, comp)).toBe('strong_apply');
  });

  it('returns strong_apply at exact boundary (both = 75)', () => {
    const fit: FitBreakdown = {
      titleMatch: 75,
      compensationFit: 75,
      locationFit: 75,
      stackOverlap: 75,
      seniorityFit: 75,
      industryFit: 75,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 75,
      experienceDepth: 75,
      domainRelevance: 75,
      leadershipMatch: 75,
      adjacentSkills: 75,
      gapPenalty: 75,
    };
    expect(classifyRecommendation(fit, comp)).toBe('strong_apply');
  });

  it('returns apply when overall >= 60 but one average < 75', () => {
    const fit: FitBreakdown = {
      titleMatch: 90,
      compensationFit: 90,
      locationFit: 90,
      stackOverlap: 90,
      seniorityFit: 90,
      industryFit: 90,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 50,
      experienceDepth: 50,
      domainRelevance: 50,
      leadershipMatch: 50,
      adjacentSkills: 50,
      gapPenalty: 50,
    };
    // Fit avg = 90, Comp avg = 50, overall = 70 >= 60
    expect(classifyRecommendation(fit, comp)).toBe('apply');
  });

  it('returns apply at exact boundary (overall = 60)', () => {
    const fit: FitBreakdown = {
      titleMatch: 60,
      compensationFit: 60,
      locationFit: 60,
      stackOverlap: 60,
      seniorityFit: 60,
      industryFit: 60,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 60,
      experienceDepth: 60,
      domainRelevance: 60,
      leadershipMatch: 60,
      adjacentSkills: 60,
      gapPenalty: 60,
    };
    // Both = 60, overall = 60 >= 60
    expect(classifyRecommendation(fit, comp)).toBe('apply');
  });

  it('returns maybe when overall >= 40 but < 60', () => {
    const fit: FitBreakdown = {
      titleMatch: 50,
      compensationFit: 50,
      locationFit: 50,
      stackOverlap: 50,
      seniorityFit: 50,
      industryFit: 50,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 40,
      experienceDepth: 40,
      domainRelevance: 40,
      leadershipMatch: 40,
      adjacentSkills: 40,
      gapPenalty: 40,
    };
    // Fit = 50, Comp = 40, overall = 45
    expect(classifyRecommendation(fit, comp)).toBe('maybe');
  });

  it('returns maybe at exact boundary (overall = 40)', () => {
    const fit: FitBreakdown = {
      titleMatch: 40,
      compensationFit: 40,
      locationFit: 40,
      stackOverlap: 40,
      seniorityFit: 40,
      industryFit: 40,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 40,
      experienceDepth: 40,
      domainRelevance: 40,
      leadershipMatch: 40,
      adjacentSkills: 40,
      gapPenalty: 40,
    };
    expect(classifyRecommendation(fit, comp)).toBe('maybe');
  });

  it('returns skip when overall < 40', () => {
    const fit: FitBreakdown = {
      titleMatch: 20,
      compensationFit: 20,
      locationFit: 20,
      stackOverlap: 20,
      seniorityFit: 20,
      industryFit: 20,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 20,
      experienceDepth: 20,
      domainRelevance: 20,
      leadershipMatch: 20,
      adjacentSkills: 20,
      gapPenalty: 20,
    };
    expect(classifyRecommendation(fit, comp)).toBe('skip');
  });

  it('returns skip when all scores are 0', () => {
    const fit: FitBreakdown = {
      titleMatch: 0,
      compensationFit: 0,
      locationFit: 0,
      stackOverlap: 0,
      seniorityFit: 0,
      industryFit: 0,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 0,
      experienceDepth: 0,
      domainRelevance: 0,
      leadershipMatch: 0,
      adjacentSkills: 0,
      gapPenalty: 0,
    };
    expect(classifyRecommendation(fit, comp)).toBe('skip');
  });

  it('returns strong_apply when all scores are 100', () => {
    const fit: FitBreakdown = {
      titleMatch: 100,
      compensationFit: 100,
      locationFit: 100,
      stackOverlap: 100,
      seniorityFit: 100,
      industryFit: 100,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 100,
      experienceDepth: 100,
      domainRelevance: 100,
      leadershipMatch: 100,
      adjacentSkills: 100,
      gapPenalty: 100,
    };
    expect(classifyRecommendation(fit, comp)).toBe('strong_apply');
  });

  it('handles asymmetric scores (high fit, low competitiveness)', () => {
    const fit: FitBreakdown = {
      titleMatch: 95,
      compensationFit: 95,
      locationFit: 95,
      stackOverlap: 95,
      seniorityFit: 95,
      industryFit: 95,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 30,
      experienceDepth: 30,
      domainRelevance: 30,
      leadershipMatch: 30,
      adjacentSkills: 30,
      gapPenalty: 30,
    };
    // Fit = 95, Comp = 30, overall = 62.5 >= 60 -> apply
    // But comp < 75, so not strong_apply
    expect(classifyRecommendation(fit, comp)).toBe('apply');
  });

  it('handles asymmetric scores (low fit, high competitiveness)', () => {
    const fit: FitBreakdown = {
      titleMatch: 30,
      compensationFit: 30,
      locationFit: 30,
      stackOverlap: 30,
      seniorityFit: 30,
      industryFit: 30,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 95,
      experienceDepth: 95,
      domainRelevance: 95,
      leadershipMatch: 95,
      adjacentSkills: 95,
      gapPenalty: 95,
    };
    // Fit = 30, Comp = 95, overall = 62.5 >= 60 -> apply
    expect(classifyRecommendation(fit, comp)).toBe('apply');
  });

  it('just below strong_apply threshold returns apply', () => {
    // Fit avg = 74 (just under 75), Comp avg = 76
    const fit: FitBreakdown = {
      titleMatch: 74,
      compensationFit: 74,
      locationFit: 74,
      stackOverlap: 74,
      seniorityFit: 74,
      industryFit: 74,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 76,
      experienceDepth: 76,
      domainRelevance: 76,
      leadershipMatch: 76,
      adjacentSkills: 76,
      gapPenalty: 76,
    };
    // Fit = 74 < 75, so not strong_apply; overall = 75 >= 60 -> apply
    expect(classifyRecommendation(fit, comp)).toBe('apply');
  });

  it('handles mixed high/low dimensions within a breakdown', () => {
    const fit: FitBreakdown = {
      titleMatch: 100,
      compensationFit: 0,
      locationFit: 100,
      stackOverlap: 0,
      seniorityFit: 100,
      industryFit: 0,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 100,
      experienceDepth: 0,
      domainRelevance: 100,
      leadershipMatch: 0,
      adjacentSkills: 100,
      gapPenalty: 0,
    };
    // Both averages = 50, overall = 50 >= 40 -> maybe
    expect(classifyRecommendation(fit, comp)).toBe('maybe');
  });
});

describe('calculateOverallScore', () => {
  it('averages fit and competitiveness scores', () => {
    expect(calculateOverallScore(80, 60)).toBe(70);
  });

  it('handles equal scores', () => {
    expect(calculateOverallScore(75, 75)).toBe(75);
  });

  it('handles zero scores', () => {
    expect(calculateOverallScore(0, 0)).toBe(0);
  });

  it('handles max scores', () => {
    expect(calculateOverallScore(100, 100)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(calculateOverallScore(81, 60)).toBe(71);
    expect(calculateOverallScore(83, 60)).toBe(72);
  });
});

describe('scoring edge cases and scenarios', () => {
  it('perfect candidate: all scores 100', () => {
    const fit: FitBreakdown = {
      titleMatch: 100,
      compensationFit: 100,
      locationFit: 100,
      stackOverlap: 100,
      seniorityFit: 100,
      industryFit: 100,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 100,
      experienceDepth: 100,
      domainRelevance: 100,
      leadershipMatch: 100,
      adjacentSkills: 100,
      gapPenalty: 100,
    };
    const recommendation = classifyRecommendation(fit, comp);
    const overall = calculateOverallScore(100, 100);
    expect(recommendation).toBe('strong_apply');
    expect(overall).toBe(100);
  });

  it('completely unqualified: all scores 0', () => {
    const fit: FitBreakdown = {
      titleMatch: 0,
      compensationFit: 0,
      locationFit: 0,
      stackOverlap: 0,
      seniorityFit: 0,
      industryFit: 0,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 0,
      experienceDepth: 0,
      domainRelevance: 0,
      leadershipMatch: 0,
      adjacentSkills: 0,
      gapPenalty: 0,
    };
    const recommendation = classifyRecommendation(fit, comp);
    const overall = calculateOverallScore(0, 0);
    expect(recommendation).toBe('skip');
    expect(overall).toBe(0);
  });

  it('good fit but poor competitiveness', () => {
    const fit: FitBreakdown = {
      titleMatch: 90,
      compensationFit: 85,
      locationFit: 95,
      stackOverlap: 80,
      seniorityFit: 75,
      industryFit: 85,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 30,
      experienceDepth: 25,
      domainRelevance: 20,
      leadershipMatch: 15,
      adjacentSkills: 35,
      gapPenalty: 25,
    };
    // Fit avg = ~85, Comp avg = ~25, overall = ~55 -> maybe
    const recommendation = classifyRecommendation(fit, comp);
    expect(recommendation).toBe('maybe');
  });

  it('career changer: strong experience but different domain', () => {
    const fit: FitBreakdown = {
      titleMatch: 40,
      compensationFit: 80,
      locationFit: 90,
      stackOverlap: 35,
      seniorityFit: 70,
      industryFit: 20,
    };
    const comp: CompetitivenessBreakdown = {
      requiredSkillsOverlap: 40,
      experienceDepth: 85,
      domainRelevance: 25,
      leadershipMatch: 75,
      adjacentSkills: 60,
      gapPenalty: 45,
    };
    // Fit avg = ~55.8, Comp avg = ~55, overall = ~55.4 -> maybe
    const recommendation = classifyRecommendation(fit, comp);
    expect(recommendation).toBe('maybe');
  });
});
