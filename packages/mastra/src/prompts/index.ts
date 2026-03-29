/**
 * Centralized Prompt Registry
 *
 * All AI prompts used across Job Pilot are defined here.
 * Import from '@job-pilot/mastra/prompts' to use.
 *
 * To edit a prompt: modify the corresponding file in this directory.
 * Version numbers track changes for audit/debugging.
 */

// Job parsing
export { JOB_PARSER_PROMPT, JOB_PARSER_PROMPT_VERSION } from './job-parser.js';

// Job-candidate scoring
export { SCORING_PROMPT, SCORING_PROMPT_VERSION } from './scoring.js';

// Resume parsing (text + PDF)
export {
  RESUME_PARSER_PROMPT,
  RESUME_PARSER_PROMPT_VERSION,
  RESUME_PARSER_PDF_INSTRUCTION,
} from './resume-parser.js';

// Resume tailoring
export { RESUME_TAILORING_PROMPT, RESUME_TAILORING_PROMPT_VERSION } from './resume-tailor.js';

// Profile coach chat
export { PROFILE_COACH_PROMPT, PROFILE_COACH_PROMPT_VERSION } from './profile-coach.js';

// Answer bank: question detection
export { DETECT_QUESTIONS_PROMPT, ANSWER_DETECT_PROMPT_VERSION } from './answer-detect.js';

// Answer bank: answer suggestion
export { SUGGEST_ANSWER_PROMPT, ANSWER_SUGGEST_PROMPT_VERSION } from './answer-suggest.js';

// Career growth advisor
export { CAREER_GROWTH_PROMPT, CAREER_GROWTH_PROMPT_VERSION } from './career-growth.js';

// Proactive profile analysis
export { PROFILE_ANALYSIS_PROMPT, PROFILE_ANALYSIS_PROMPT_VERSION } from './profile-analysis.js';

// Cover letter generation
export { COVER_LETTER_PROMPT, COVER_LETTER_PROMPT_VERSION } from './cover-letter.js';

// "Why this company?" answer generation
export { WHY_COMPANY_PROMPT, WHY_COMPANY_PROMPT_VERSION } from './why-company.js';

// Application ghostwriter
export { GHOSTWRITER_PROMPT, GHOSTWRITER_PROMPT_VERSION } from './ghostwriter.js';

// Resume depth interview
export { RESUME_INTERVIEW_PROMPT, RESUME_INTERVIEW_PROMPT_VERSION } from './resume-interview.js';

/** All prompt versions for audit logging */
export const PROMPT_VERSIONS = {
  jobParser: () => import('./job-parser.js').then((m) => m.JOB_PARSER_PROMPT_VERSION),
  scoring: () => import('./scoring.js').then((m) => m.SCORING_PROMPT_VERSION),
  resumeParser: () => import('./resume-parser.js').then((m) => m.RESUME_PARSER_PROMPT_VERSION),
  resumeTailor: () => import('./resume-tailor.js').then((m) => m.RESUME_TAILORING_PROMPT_VERSION),
  profileCoach: () => import('./profile-coach.js').then((m) => m.PROFILE_COACH_PROMPT_VERSION),
  answerDetect: () => import('./answer-detect.js').then((m) => m.ANSWER_DETECT_PROMPT_VERSION),
  answerSuggest: () => import('./answer-suggest.js').then((m) => m.ANSWER_SUGGEST_PROMPT_VERSION),
  careerGrowth: () => import('./career-growth.js').then((m) => m.CAREER_GROWTH_PROMPT_VERSION),
  profileAnalysis: () =>
    import('./profile-analysis.js').then((m) => m.PROFILE_ANALYSIS_PROMPT_VERSION),
  coverLetter: () => import('./cover-letter.js').then((m) => m.COVER_LETTER_PROMPT_VERSION),
  whyCompany: () => import('./why-company.js').then((m) => m.WHY_COMPANY_PROMPT_VERSION),
  ghostwriter: () => import('./ghostwriter.js').then((m) => m.GHOSTWRITER_PROMPT_VERSION),
  resumeInterview: () =>
    import('./resume-interview.js').then((m) => m.RESUME_INTERVIEW_PROMPT_VERSION),
} as const;
