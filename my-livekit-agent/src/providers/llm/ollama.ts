import * as openai from '@livekit/agents-plugin-openai';
import type { llm } from '@livekit/agents';

import type { LlmConfig } from '../../config/types.js';

export function createOllamaLlm(cfg: LlmConfig): llm.LLM {
  return openai.LLM.withOllama({
    model: cfg.model,
    baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    temperature: cfg.temperature,
  });
}
