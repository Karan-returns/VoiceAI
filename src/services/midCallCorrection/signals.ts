import type { CorrectionSignal, SentimentLevel } from './types.js';
import { SIGNAL_PRIORITY } from './types.js';

const ESCALATION_PATTERN =
  /\b(cancel|manager|supervisor|ridiculous|lawsuit|unacceptable|speak to someone|this is absurd|waste of time)\b/i;

const ANGRY_PATTERN =
  /\b(furious|outraged|worst|hate|sue|lawsuit|ridiculous|unacceptable|pathetic|scam)\b/i;

const FRUSTRATED_PATTERN =
  /\b(again|still|every time|not helping|already (told|explained|said)|keeps happening|same (issue|problem|thing))\b/i;

const POSITIVE_PATTERN =
  /\b(thanks|thank you|thank|appreciate|that helps|great|perfect|wonderful|i understand|got it|makes sense|okay|alright)\b/i;

const DE_ESCALATION_THANKS_PATTERN =
  /\b(thank you|thanks|thank|appreciate|that helps|that worked|much better)\b/i;

const DE_ESCALATION_UNDERSTANDING_PATTERN =
  /\b(i understand|i understood|understood|makes sense|i get it|i see what you mean)\b/i;

const DE_ESCALATION_AFFIRMATION_PATTERN =
  /\b(got it|okay|ok|alright|fair enough|sounds good|no worries|all good)\b/i;

const CUSTOMER_SARCASM_PATTERN =
  /\b(your fault|you people|this is ridiculous|not helping|useless|still waiting)\b/i;

const ACKNOWLEDGMENT_PATTERN =
  /\b(i understand|i hear you|i'm sorry|that must be|i can see why|i get why|frustrating|sorry this)\b/i;

const OBJECTION_TOPICS: Array<{ id: string; pattern: RegExp }> = [
  { id: 'bill_wrong', pattern: /\b(bill|charged|charge|twice|duplicate|wrong amount|overcharged)\b/i },
  { id: 'cancel', pattern: /\b(cancel|cancellation|too expensive|terminate|end (my|the) (plan|service))\b/i },
  { id: 'late_fee', pattern: /\b(late fee|penalty|paid on time)\b/i },
  { id: 'manager', pattern: /\b(manager|supervisor|escalat|speak to someone)\b/i },
];

const SENTIMENT_INDEX: Record<SentimentLevel, number> = {
  angry: 0,
  frustrated: 1,
  neutral: 2,
  positive: 3,
};

export function detectEscalationLanguage(text: string): string | null {
  if (detectDeEscalation(text)) {
    return null;
  }

  const match = text.match(ESCALATION_PATTERN);
  return match?.[0]?.toLowerCase() ?? null;
}

export type DeEscalationKind = 'thank_you' | 'understanding' | 'affirmation';

export function detectDeEscalation(text: string): DeEscalationKind | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  if (
    ESCALATION_PATTERN.test(normalized) ||
    ANGRY_PATTERN.test(normalized) ||
    CUSTOMER_SARCASM_PATTERN.test(normalized)
  ) {
    return null;
  }

  if (DE_ESCALATION_THANKS_PATTERN.test(normalized)) {
    return 'thank_you';
  }

  if (DE_ESCALATION_UNDERSTANDING_PATTERN.test(normalized)) {
    return 'understanding';
  }

  if (DE_ESCALATION_AFFIRMATION_PATTERN.test(normalized)) {
    return 'affirmation';
  }

  return null;
}

export function scoreSentiment(text: string): SentimentLevel {
  const normalized = text.trim();
  if (!normalized) {
    return 'neutral';
  }

  if (ANGRY_PATTERN.test(normalized)) {
    return 'angry';
  }

  if (FRUSTRATED_PATTERN.test(normalized)) {
    return 'frustrated';
  }

  if (POSITIVE_PATTERN.test(normalized)) {
    return 'positive';
  }

  return 'neutral';
}

export function sentimentDropLevels(previous: SentimentLevel, current: SentimentLevel): number {
  return SENTIMENT_INDEX[previous] - SENTIMENT_INDEX[current];
}

export function detectObjectionTopic(text: string): string | null {
  for (const topic of OBJECTION_TOPICS) {
    if (topic.pattern.test(text)) {
      return topic.id;
    }
  }
  return null;
}

export function agentAddressedObjection(agentText: string, topicId: string): boolean {
  const topic = OBJECTION_TOPICS.find((t) => t.id === topicId);
  if (!topic) {
    return false;
  }

  if (ACKNOWLEDGMENT_PATTERN.test(agentText)) {
    return true;
  }

  return topic.pattern.test(agentText);
}

export function pickHighestPrioritySignal(
  signals: Array<{ signal: CorrectionSignal; evidence?: string }>,
): { signal: CorrectionSignal; evidence?: string } | null {
  if (signals.length === 0) {
    return null;
  }

  let best = signals[0]!;
  for (const candidate of signals.slice(1)) {
    if (SIGNAL_PRIORITY[candidate.signal] > SIGNAL_PRIORITY[best.signal]) {
      best = candidate;
    }
  }

  return best;
}
