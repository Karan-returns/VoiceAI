import * as openai from '@livekit/agents-plugin-openai';
import type { llm } from '@livekit/agents';

import type { LlmConfig } from '../../config/types.js';

export function createGroqLlm(cfg: LlmConfig): llm.LLM {
  return openai.LLM.withGroq({
    model: cfg.model,
    temperature: cfg.temperature,
  });
}
