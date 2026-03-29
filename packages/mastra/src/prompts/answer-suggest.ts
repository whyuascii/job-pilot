/**
 * Answer Suggestion Prompt
 * Generates tailored answers to application questions based on candidate profile.
 *
 * @version 1.0.0
 * @lastUpdated 2026-03-26
 */
export const ANSWER_SUGGEST_PROMPT_VERSION = '1.0.0';

export const SUGGEST_ANSWER_PROMPT = `You are an expert career coach. Given a question, candidate profile, similar answers, and job context, generate a tailored answer. Return JSON: { suggestedAnswer: string, confidence: "high"|"medium"|"low", sourceEvidence: string, reasoning: string }`;
