import type { llm } from '@livekit/agents';

import type { LlmConfig } from '../../config/types.js';
import { createGroqLlm } from './groq.js';
import { createLivekitLlm } from './livekit.js';
import { createOllamaLlm } from './ollama.js';
import { createOpenAiLlm } from './openai.js';

export function createLlm(cfg: LlmConfig): llm.LLM {
  switch (cfg.provider) {
    case 'openai':
      return createOpenAiLlm(cfg);
    case 'groq':
      return createGroqLlm(cfg);
    case 'ollama':
      return createOllamaLlm(cfg);
    case 'livekit':
      return createLivekitLlm(cfg);
    default: {
      const exhaustive: never = cfg.provider;
      throw new Error(`Unsupported LLM provider: ${exhaustive}`);
    }
  }
}
