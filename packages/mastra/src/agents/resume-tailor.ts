import { Agent } from '@mastra/core';

import { RESUME_TAILORING_PROMPT } from '../prompts/resume-tailor.js';

export const resumeTailorAgent = new Agent({
  name: 'Resume Tailor',
  instructions: RESUME_TAILORING_PROMPT,
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514',
  },
});
