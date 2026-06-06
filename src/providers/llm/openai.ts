import * as openai from '@livekit/agents-plugin-openai';
import type { llm } from '@livekit/agents';

import type { LlmConfig } from '../../config/types.js';

export function createOpenAiLlm(cfg: LlmConfig): llm.LLM {
  return new openai.LLM({
    model: cfg.model,
    temperature: cfg.temperature,
  });
}
