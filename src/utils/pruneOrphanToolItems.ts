import type { llm } from '@livekit/agents';

import { createLogger } from './logger.js';

const logger = createLogger('chatContext');

/**
 * Remove tool calls/outputs whose callId pair was broken by interruption.
 * Prevents "function output missing the corresponding function call" stalls.
 */
export function pruneOrphanToolItems(chatCtx: llm.ChatContext): number {
  const callIds = new Set<string>();
  const outputIds = new Set<string>();

  for (const item of chatCtx.items) {
    if (item.type === 'function_call') {
      callIds.add(item.callId);
    } else if (item.type === 'function_call_output') {
      outputIds.add(item.callId);
    }
  }

  const validIds = new Set([...callIds].filter((id) => outputIds.has(id)));
  const before = chatCtx.items.length;

  chatCtx.items = chatCtx.items.filter((item) => {
    if (item.type === 'function_call') {
      const keep = validIds.has(item.callId);
      if (!keep) {
        logger.warn(
          { callId: item.callId, toolName: item.name },
          'Pruned orphan function call from chat context',
        );
      }
      return keep;
    }

    if (item.type === 'function_call_output') {
      const keep = validIds.has(item.callId);
      if (!keep) {
        logger.warn(
          { callId: item.callId, toolName: item.name },
          'Pruned orphan function output from chat context',
        );
      }
      return keep;
    }

    return true;
  });

  return before - chatCtx.items.length;
}
