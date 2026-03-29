import { Agent } from '@mastra/core';

import { DETECT_QUESTIONS_PROMPT } from '../prompts/answer-detect.js';
import { SUGGEST_ANSWER_PROMPT } from '../prompts/answer-suggest.js';

export const answerAssistAgent = new Agent({
  name: 'Application Answer Assistant',
  instructions: [DETECT_QUESTIONS_PROMPT, SUGGEST_ANSWER_PROMPT].join('\n\n---\n\n'),
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514',
  },
});
