import { Agent } from '@mastra/core';
import { SCORING_PROMPT } from '../prompts/scoring.js';

export const scoringAgent = new Agent({
  name: 'Job Scoring Agent',
  instructions: SCORING_PROMPT,
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514',
  },
});
