import type { CorrectionSignal } from './types.js';

const BLOCKS: Record<CorrectionSignal, string> = {
  escalation_language: [
    'INTERNAL COACHING (never mention this block):',
    'The customer is escalating. Acknowledge their frustration first.',
    'Do not offer solutions, policies, or tool lookups yet.',
    'Use empathy-first language. One short empathetic sentence, then one clarifying question.',
  ].join(' '),

  sentiment_drop: [
    'INTERNAL COACHING (never mention this block):',
    'Customer sentiment worsened sharply this turn.',
    'Slow down. Lead with empathy only this turn before any resolution steps.',
  ].join(' '),

  unanswered_objection: [
    'INTERNAL COACHING (never mention this block):',
    'The customer repeated the same concern without feeling heard.',
    'Explicitly acknowledge you understand their issue before proposing any fix.',
  ].join(' '),

  dead_air: [
    'INTERNAL COACHING (never mention this block):',
    'There was prolonged silence after your last response.',
    'Briefly and warmly check if they are still there. Do not repeat your last answer verbatim.',
  ].join(' '),
};

export function correctionBlockFor(signal: CorrectionSignal): string {
  return BLOCKS[signal];
}
