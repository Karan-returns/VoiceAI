import { inference } from '@livekit/agents';
import type { llm } from '@livekit/agents';

import type { LlmConfig } from '../../config/types.js';

export function createLivekitLlm(cfg: LlmConfig): llm.LLM {
  const modelString = cfg.model.includes('/') ? cfg.model : `openai/${cfg.model}`;
  const llmInstance = inference.LLM.fromModelString(modelString);

  llmInstance.updateOptions({
    modelOptions: {
      temperature: cfg.temperature,
    },
  });

  return llmInstance;
}
