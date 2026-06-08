import type { ConversationTurn } from '../db/types.js';
import { DEAD_AIR_GRACE_MS, DEAD_AIR_THRESHOLD_MS } from '../services/midCallCorrection/types.js';
import type { HeuristicSignals } from './types.js';

const FILLER_PATTERN =
  /\b(um+|uh+|like|you know|basically|actually|so yeah|i mean)\b/gi;
const ESCALATION_PATTERN =
  /\b(cancel|manager|supervisor|lawsuit|lawyer|complaint|ridiculous|unacceptable|speak to someone)\b/i;
const GREETING_PATTERN =
  /\b(hello|hi|hey|good (morning|afternoon|evening)|thank you for calling|thanks for calling|welcome)\b/i;
const INTRODUCTION_PATTERN =
  /\b(novatel|this is|my name is|i'm|i am|speaking|you'?re (speaking|through) to)\b/i;

// Message timestamps are committed AFTER the STT→LLM→TTS pipeline runs, so the gap between a
// customer turn and the next agent turn always includes normal response latency. Only count it as
// "dead air" once it exceeds the same budget the live mid-call monitor uses (grace + threshold),
// otherwise every healthy turn gets falsely flagged.
const DEAD_AIR_GAP_SECONDS = (DEAD_AIR_GRACE_MS + DEAD_AIR_THRESHOLD_MS) / 1000;

// Connection warmup can delay the agent's first turn (and make the customer speak first). Allow a
// grace window so transport latency is not mistaken for a slow greeting.
const GREETING_GRACE_SECONDS = 8;

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function turnGapSeconds(turns: ConversationTurn[], index: number): number {
  const current = turns[index];
  const previous = turns[index - 1];
  if (!current || !previous) {
    return 0;
  }
  return (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
}

export function computeHeuristicSignals(turns: ConversationTurn[]): HeuristicSignals {
  const agentTurns = turns.filter((turn) => turn.role === 'agent');
  const customerTurns = turns.filter((turn) => turn.role === 'customer');

  let fillerWords = 0;
  let totalAgentWords = 0;

  for (const turn of agentTurns) {
    const matches = turn.content.match(FILLER_PATTERN);
    fillerWords += matches?.length ?? 0;
    totalAgentWords += turn.content.split(/\s+/).filter(Boolean).length;
  }

  const callStartMs = turns[0]?.timestamp.getTime() ?? 0;

  const deadAirFlags: string[] = [];
  for (let index = 1; index < turns.length; index++) {
    const turn = turns[index];
    const previous = turns[index - 1];
    if (!turn || !previous) {
      continue;
    }
    if (previous.role === 'customer' && turn.role === 'agent') {
      const gap = turnGapSeconds(turns, index);
      if (gap >= DEAD_AIR_GAP_SECONDS) {
        const offsetSeconds = (turn.timestamp.getTime() - callStartMs) / 1000;
        deadAirFlags.push(`dead_air_at_${formatTimestamp(offsetSeconds)}`);
      }
    }
  }

  const escalationFlags: string[] = [];
  for (const turn of customerTurns) {
    if (ESCALATION_PATTERN.test(turn.content)) {
      escalationFlags.push(`escalation_at_${formatTimestamp(turn.timestamp.getTime() / 1000)}`);
    }
  }

  const firstAgentTurn = agentTurns[0];
  const callStart = turns[0]?.timestamp;
  const agentSpokeFirst = turns[0]?.role === 'agent';
  const greetingLatencySeconds =
    firstAgentTurn && callStart
      ? (firstAgentTurn.timestamp.getTime() - callStart.getTime()) / 1000
      : 0;
  const greetingText = firstAgentTurn?.content ?? '';
  const greetingQualityOk =
    GREETING_PATTERN.test(greetingText) && INTRODUCTION_PATTERN.test(greetingText);
  // Prompt greeting = agent opened the call, or greeted within a warmup-tolerant window. We no
  // longer fail solely on transport latency that pushed the customer to speak first.
  const greetingWithin5s =
    Boolean(firstAgentTurn) && (agentSpokeFirst || greetingLatencySeconds <= GREETING_GRACE_SECONDS);

  const repeatedCustomerTopics = new Map<string, number>();
  for (const turn of customerTurns) {
    const normalized = turn.content.toLowerCase().slice(0, 80);
    repeatedCustomerTopics.set(normalized, (repeatedCustomerTopics.get(normalized) ?? 0) + 1);
  }
  const unresolvedObjectionsHint = [...repeatedCustomerTopics.values()].filter((count) => count >= 2).length;

  return {
    filler_words: fillerWords,
    avg_response_words:
      agentTurns.length > 0 ? Math.round(totalAgentWords / agentTurns.length) : 0,
    dead_air_flags: deadAirFlags,
    escalation_flags: escalationFlags,
    greeting_within_5s: greetingWithin5s,
    greeting_latency_seconds: Math.round(greetingLatencySeconds * 10) / 10,
    greeting_quality_ok: greetingQualityOk,
    agent_spoke_first: agentSpokeFirst,
    unresolved_objections_hint: unresolvedObjectionsHint,
  };
}

export function formatTranscript(turns: ConversationTurn[]): string {
  return turns
    .map((turn) => {
      const speaker = turn.role === 'customer' ? 'Customer' : 'Agent';
      return `[${turn.timestamp.toISOString()}] ${speaker}: ${turn.content}`;
    })
    .join('\n');
}

export function formatHeuristicHints(signals: HeuristicSignals): string {
  return [
    `Filler words (agent): ${signals.filler_words}`,
    `Average agent response length (words): ${signals.avg_response_words}`,
    `Agent spoke first: ${signals.agent_spoke_first ? 'yes' : 'no'}`,
    `Agent first-turn latency (s, includes transport/warmup): ${signals.greeting_latency_seconds}`,
    `First turn contains greeting + introduction: ${signals.greeting_quality_ok ? 'yes' : 'no'}`,
    `Prompt greeting (warmup-tolerant): ${signals.greeting_within_5s ? 'yes' : 'no'}`,
    `Genuine dead-air flags (latency-adjusted, >=${DEAD_AIR_GAP_SECONDS}s): ${signals.dead_air_flags.join(', ') || 'none'}`,
    `Escalation flags: ${signals.escalation_flags.join(', ') || 'none'}`,
    `Repeated customer topics (objection hint): ${signals.unresolved_objections_hint}`,
  ].join('\n');
}


// Dead Air
// Greeting Latency
// Greeting Quality
// Filler Words
// Escalation Detection
// Agent Spoke First
// Response Length
// Repeated Objections