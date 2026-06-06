import type { ConversationTurn } from '../db/types.js';
import type { HeuristicSignals } from './types.js';

const FILLER_PATTERN = /\b(um+|uh+|uhm+|like|you know|i mean|sort of|kind of)\b/gi;

const ESCALATION_KEYWORDS = [
  'cancel',
  'cancellation',
  'manager',
  'supervisor',
  'lawsuit',
  'sue',
  'legal',
  'attorney',
  'lawyer',
];

const DEAD_AIR_THRESHOLD_MS = 3000;
const GREETING_WINDOW_MS = 5000;

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function countFillerWords(text: string): number {
  const matches = text.match(FILLER_PATTERN);
  return matches?.length ?? 0;
}

function isRaisedTone(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) {
    return false;
  }
  const upper = text.replace(/[^A-Z]/g, '').length;
  const ratio = upper / letters.length;
  const hasShoutingPunctuation = /!{2,}/.test(text) || /\?{2,}/.test(text);
  return ratio > 0.6 || (ratio > 0.4 && hasShoutingPunctuation);
}

function detectEscalationInText(text: string, elapsedSeconds: number): string | null {
  const lower = text.toLowerCase();
  for (const keyword of ESCALATION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return `escalation_at_${formatElapsed(elapsedSeconds)}`;
    }
  }
  if (isRaisedTone(text)) {
    return `raised_tone_at_${formatElapsed(elapsedSeconds)}`;
  }
  return null;
}

export function formatTranscriptForAnalysis(turns: ConversationTurn[]): string {
  if (turns.length === 0) {
    return '(empty transcript)';
  }

  const callStart = turns[0]!.timestamp.getTime();

  return turns
    .map((turn, index) => {
      const elapsedMs = turn.timestamp.getTime() - callStart;
      const elapsed = formatElapsed(elapsedMs / 1000);
      const preview = turn.content.replace(/\s+/g, ' ').trim();
      return `${index} | ${elapsed} | ${turn.role} | ${preview}`;
    })
    .join('\n');
}

export function computeHeuristicSignals(turns: ConversationTurn[]): HeuristicSignals {
  const agentTurns = turns.filter((t) => t.role === 'agent');
  const fillerWords = agentTurns.reduce((sum, turn) => sum + countFillerWords(turn.content), 0);

  const responseWordCounts = agentTurns.map((turn) => wordCount(turn.content));
  const avgResponseWords =
    responseWordCounts.length > 0
      ? Math.round(
          responseWordCounts.reduce((sum, count) => sum + count, 0) / responseWordCounts.length,
        )
      : 0;

  const callStart = turns[0]?.timestamp.getTime() ?? Date.now();
  const deadAirFlags: string[] = [];
  const escalationFlags: string[] = [];

  for (let i = 1; i < turns.length; i++) {
    const prev = turns[i - 1]!;
    const current = turns[i]!;
    const gapMs = current.timestamp.getTime() - prev.timestamp.getTime();
    const elapsedSeconds = (current.timestamp.getTime() - callStart) / 1000;

    if (gapMs > DEAD_AIR_THRESHOLD_MS) {
      deadAirFlags.push(`dead_air_at_${formatElapsed(elapsedSeconds)}`);
    }

    if (current.role === 'customer') {
      const flag = detectEscalationInText(current.content, elapsedSeconds);
      if (flag) {
        escalationFlags.push(flag);
      }
    }
  }

  const firstAgentTurn = agentTurns[0];
  let greetingWithin5s: boolean | null = null;
  let greetingEvidence = 'No agent turns recorded.';

  if (firstAgentTurn) {
    const greetingDelayMs = firstAgentTurn.timestamp.getTime() - callStart;
    greetingWithin5s = greetingDelayMs <= GREETING_WINDOW_MS;
    greetingEvidence = `First agent turn at +${formatElapsed(greetingDelayMs / 1000)}: "${firstAgentTurn.content.slice(0, 80)}..."`;
  }

  return {
    filler_words: fillerWords,
    avg_response_words: avgResponseWords,
    dead_air_flags: deadAirFlags,
    escalation_flags: escalationFlags,
    greeting_within_5s: greetingWithin5s,
    greeting_evidence: greetingEvidence,
  };
}

export function assessResponseLength(
  avgWords: number,
): 'terse' | 'balanced' | 'rambling' {
  if (avgWords < 12) {
    return 'terse';
  }
  if (avgWords > 45) {
    return 'rambling';
  }
  return 'balanced';
}
