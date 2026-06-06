import type { CorrectionSignal, SentimentLevel } from './types.js';
import { SIGNAL_PRIORITY } from './types.js';

const ESCALATION_PATTERN =
  /\b(cancel|manager|supervisor|ridiculous|lawsuit|unacceptable|speak to someone|this is absurd|waste of time)\b/i;

const ANGRY_PATTERN =
  /\b(furious|outraged|worst|hate|sue|lawsuit|ridiculous|unacceptable|pathetic|scam)\b/i;

const FRUSTRATED_PATTERN =
  /\b(again|still|every time|not helping|already (told|explained|said)|keeps happening|same (issue|problem|thing))\b/i;

const POSITIVE_PATTERN = /\b(thanks|thank you|appreciate|that helps|great|perfect|wonderful)\b/i;

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
  const match = text.match(ESCALATION_PATTERN);
  return match?.[0]?.toLowerCase() ?? null;
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
