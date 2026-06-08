import type { voice } from '@livekit/agents';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('latencyFiller');

/** Short spoken acknowledgments — warm and natural; avoids prompt-banned phrases like "let me check". */
const LATENCY_FILLER_PHRASES = [
  'Yeah, absolutely.',
  'Oh okay, got it.',
  'Right, I hear you.',
  'Sure thing.',
  "Yeah, I'm with you on that.",
  'Ah, okay — thanks for explaining.',
  'Gotcha, thanks.',
  "Yeah, that's fair.",
] as const;

export function pickRandomLatencyFiller(): string {
  const index = Math.floor(Math.random() * LATENCY_FILLER_PHRASES.length);
  return LATENCY_FILLER_PHRASES[index] ?? 'Okay, I understand.';
}

/**
 * Speak a filler immediately (non-blocking) to cover dead air while billing
 * prefetch and LLM inference run. Skipped on the greeting because
 * onUserTurnCompleted only fires after the customer has spoken.
 */
export function playLatencyFiller(session: voice.AgentSession): void {
  const filler = pickRandomLatencyFiller();
  logger.debug({ filler }, 'Playing latency filler');
  session.say(filler, { addToChatCtx: false });
}
