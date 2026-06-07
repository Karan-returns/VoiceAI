export type CorrectionSignal =
  | 'de_escalation'
  | 'escalation_language'
  | 'sentiment_drop'
  | 'unanswered_objection'
  | 'dead_air';

export type SentimentLevel = 'positive' | 'neutral' | 'frustrated' | 'angry';

export interface PendingCorrection {
  signal: CorrectionSignal;
  block: string;
  evidence?: string;
  detectedAt: number;
}

export interface InjectedCorrection {
  signal: CorrectionSignal;
  blockId: CorrectionSignal;
  evidence?: string;
  injectedAt: number;
  latencyMs: number;
  turnIndex: number;
}

export const CORRECTION_MESSAGE_ID = 'lk.midcall.correction';

export const SIGNAL_PRIORITY: Record<CorrectionSignal, number> = {
  de_escalation: 5,
  escalation_language: 4,
  sentiment_drop: 3,
  unanswered_objection: 2,
  dead_air: 1,
};

export const DEAD_AIR_THRESHOLD_MS = 3000;

/** Wait after agent stops speaking before dead-air detection can fire. */
export const DEAD_AIR_GRACE_MS = 6000;

/** Discard dead-air flags older than this once the customer speaks again. */
export const DEAD_AIR_STALE_MS = 45_000;
