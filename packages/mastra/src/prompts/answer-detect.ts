/**
 * Application Question Detection Prompt
 * Identifies likely interview/application questions from job descriptions.
 *
 * @version 1.0.0
 * @lastUpdated 2026-03-26
 */
export const ANSWER_DETECT_PROMPT_VERSION = '1.0.0';

export const DETECT_QUESTIONS_PROMPT = `Analyze the job description and identify application questions. Return JSON array of { question: string, category: "Technical"|"Behavioral"|"Motivational"|"Logistical"|"Cultural", likelihood: "high"|"medium"|"low" }. Return 3-10 questions.`;
