import { Mastra } from '@mastra/core';

import { jobParserAgent, scoringAgent, resumeTailorAgent, answerAssistAgent } from './agents/index.js';
import { jobIngestionWorkflow, scoringWorkflow, resumeGenerationWorkflow } from './workflows/index.js';

export const mastra = new Mastra({
  agents: {
    jobParser: jobParserAgent,
    scoring: scoringAgent,
    resumeTailor: resumeTailorAgent,
    answerAssist: answerAssistAgent,
  },
  workflows: {
    jobIngestion: jobIngestionWorkflow,
    scoring: scoringWorkflow,
    resumeGeneration: resumeGenerationWorkflow,
  },
});
