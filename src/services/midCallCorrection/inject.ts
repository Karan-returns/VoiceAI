import { llm } from '@livekit/agents';

import { CORRECTION_MESSAGE_ID } from './types.js';

export function injectCorrectionBlock(chatCtx: llm.ChatContext, block: string): void {
  const message = llm.ChatMessage.create({
    id: CORRECTION_MESSAGE_ID,
    role: 'system',
    content: block,
  });

  const idx = chatCtx.indexById(CORRECTION_MESSAGE_ID);
  if (idx !== undefined) {
    chatCtx.items[idx] = message;
    return;
  }

  chatCtx.insert(message);
}

export function clearCorrectionBlock(chatCtx: llm.ChatContext): boolean {
  const idx = chatCtx.indexById(CORRECTION_MESSAGE_ID);
  if (idx === undefined) {
    return false;
  }

  chatCtx.items.splice(idx, 1);
  return true;
}
