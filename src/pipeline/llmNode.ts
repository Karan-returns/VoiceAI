import type { llm, voice } from '@livekit/agents';
import { voice as voiceNs } from '@livekit/agents';
import type { ReadableStream } from 'node:stream/web';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('pipeline.llm');

/**
 * LLM stage of the voice pipeline.
 *
 * Input:  chat history + tool definitions
 * Output: streamed text tokens from the language model
 *
 * Python analogy:
 *   async def llm_node(...) -> AsyncIterator[str]:
 *       log_last_user_message(chat_ctx)
 *       return await super().llm_node(...)
 */
export async function runLlmNode(
  agent: voice.Agent,
  chatCtx: llm.ChatContext,
  toolCtx: llm.ToolContext,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<llm.ChatChunk | string> | null> {
  const messages = chatCtx.items;
  const lastIndex = messages.length - 1;

  if (lastIndex >= 0) {
    const lastMessage = messages[lastIndex];
    if (lastMessage !== undefined && 'content' in lastMessage) {
      logger.debug({ content: lastMessage.content }, 'LLM input');
    }
  }

  // Call the framework default implementation (like super().llm_node(...) in Python).
  return voiceNs.Agent.default.llmNode(agent, chatCtx, toolCtx, modelSettings);
}
