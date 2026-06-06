import type { llm, voice } from '@livekit/agents';
import { voice as voiceNs } from '@livekit/agents';
import type { ReadableStream } from 'node:stream/web';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('pipeline.llm');

export async function runLlmNode(
  agent: voice.Agent,
  chatCtx: llm.ChatContext,
  toolCtx: llm.ToolContext,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<llm.ChatChunk | string> | null> {
  const lastMessage = chatCtx.items.at(-1);
  if (lastMessage && 'content' in lastMessage) {
    logger.debug({ content: lastMessage.content }, 'LLM input');
  }

  return voiceNs.Agent.default.llmNode(agent, chatCtx, toolCtx, modelSettings);
}
