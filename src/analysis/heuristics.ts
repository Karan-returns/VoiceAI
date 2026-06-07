import type { ConversationTurn } from '../db/types.js';
import type { HeuristicSignals } from './types.js';

const FILLER_PATTERN =
  /\b(um+|uh+|like|you know|basically|actually|so yeah|i mean)\b/gi;
const ESCALATION_PATTERN =
  /\b(cancel|manager|supervisor|lawsuit|lawyer|complaint|ridiculous|unacceptable|speak to someone)\b/i;

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

  const deadAirFlags: string[] = [];
  for (let index = 1; index < turns.length; index++) {
    const turn = turns[index];
    const previous = turns[index - 1];
    if (!turn || !previous) {
      continue;
    }
    if (previous.role === 'agent' && turn.role === 'customer') {
      const gap = turnGapSeconds(turns, index);
      if (gap >= 3) {
        deadAirFlags.push(`dead_air_at_${formatTimestamp(turn.timestamp.getTime() / 1000)}`);
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
  const greetingWithin5s =
    Boolean(firstAgentTurn && callStart) &&
    (firstAgentTurn!.timestamp.getTime() - callStart!.getTime()) / 1000 <= 5;

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
    `Greeting within 5s: ${signals.greeting_within_5s ? 'yes' : 'no'}`,
    `Dead-air flags: ${signals.dead_air_flags.join(', ') || 'none'}`,
    `Escalation flags: ${signals.escalation_flags.join(', ') || 'none'}`,
    `Repeated customer topics (objection hint): ${signals.unresolved_objections_hint}`,
  ].join('\n');
}
