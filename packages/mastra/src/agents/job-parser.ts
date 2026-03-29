import { Agent } from '@mastra/core';

import { JOB_PARSER_PROMPT } from '../prompts/job-parser.js';

export const jobParserAgent = new Agent({
  name: 'Job Parser',
  instructions: JOB_PARSER_PROMPT,
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-sonnet-4-20250514',
  },
});
