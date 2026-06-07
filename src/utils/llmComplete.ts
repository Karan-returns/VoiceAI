import { llm } from '@livekit/agents';

import type { AppConfig } from '../config/types.js';
import { createProviders } from '../providers/index.js';

async function drainLlmStream(stream: AsyncIterable<llm.ChatChunk>): Promise<string> {
  let text = '';

  for await (const chunk of stream) {
    const content = chunk.delta?.content;
    if (content) {
      text += content;
    }
  }

  return text.trim();
}

export async function completeWithLlm(
  config: AppConfig,
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number } = {},
): Promise<string> {
  const providers = createProviders(config);
  const chatCtx = llm.ChatContext.empty();
  chatCtx.addMessage({ role: 'system', content: systemPrompt });
  chatCtx.addMessage({ role: 'user', content: userPrompt });

  const llmInstance = providers.llm;
  if (options.temperature !== undefined && 'updateOptions' in llmInstance) {
    (llmInstance as { updateOptions: (opts: { modelOptions: { temperature: number } }) => void }).updateOptions({
      modelOptions: { temperature: options.temperature },
    });
  }

  const stream = llmInstance.chat({
    chatCtx,
    connOptions: { maxRetry: 2, retryIntervalMs: 500, timeoutMs: 30_000 },
  });

  return drainLlmStream(stream);
}

export function parseJsonFromLlm<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  return JSON.parse(candidate) as T;
}
