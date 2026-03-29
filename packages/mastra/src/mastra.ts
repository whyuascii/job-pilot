import { Mastra } from '@mastra/core';

import {
  answerAssistAgent,
  jobParserAgent,
  resumeTailorAgent,
  scoringAgent,
} from './agents/index.js';
import {
  jobIngestionWorkflow,
  resumeGenerationWorkflow,
  scoringWorkflow,
} from './workflows/index.js';

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
