import type { CallAnalysisScorecard, CallDetail, MidCallCorrection, Sentiment, TurnAnnotation } from '../types';

const SENTIMENT_SCORE: Record<Sentiment, number> = {
  positive: 4,
  neutral: 3,
  frustrated: 2,
  angry: 1,
};

export function sentimentToScore(s: Sentiment): number {
  return SENTIMENT_SCORE[s];
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-pass)';
  if (score >= 65) return 'var(--color-warn)';
  return 'var(--color-fail)';
}

export function formatDuration(ms?: number): string {
  if (!ms) return '—';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string, startIso: string): string {
  const offset = new Date(iso).getTime() - new Date(startIso).getTime();
  const sec = Math.max(0, Math.floor(offset / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function parseFlagTurnIndex(flag: string, turns: CallDetail['turns'], startIso: string): number | null {
  const timeMatch = flag.match(/(\d{2}):(\d{2})/);
  if (!timeMatch) return null;
  const targetMs = (Number(timeMatch[1]) * 60 + Number(timeMatch[2])) * 1000;
  const startMs = new Date(startIso).getTime();

  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < turns.length; i++) {
    const turnMs = new Date(turns[i].timestamp).getTime() - startMs;
    const diff = Math.abs(turnMs - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function buildTurnAnnotations(call: CallDetail): TurnAnnotation[] {
  const analysis = call.analysis;
  if (!analysis) return call.turns.map((_, i) => ({ turnIndex: i, flags: [], corrections: [], rubricEvidence: [] }));

  const startIso = call.startedAt;
  const flagByTurn = new Map<number, string[]>();

  for (const flag of analysis.flags) {
    const idx = parseFlagTurnIndex(flag, call.turns, startIso);
    if (idx !== null) {
      const existing = flagByTurn.get(idx) ?? [];
      existing.push(flag);
      flagByTurn.set(idx, existing);
    }
  }

  const correctionsByTurn = new Map<number, MidCallCorrection[]>();
  for (const c of call.corrections ?? []) {
    const existing = correctionsByTurn.get(c.turnIndex) ?? [];
    existing.push(c);
    correctionsByTurn.set(c.turnIndex, existing);
  }

  const sentimentByTurn = new Map(analysis.sentiment_arc.map((s) => [s.turn_index, s]));
  const stageByTurn = new Map(analysis.call_flow.map((f) => [f.turn_index, f.stage]));

  return call.turns.map((_, i) => {
    const sentimentEntry = sentimentByTurn.get(i);
    const relatedRubric = analysis.rubric
      .filter((r) => r.evidence.toLowerCase().includes(`turn ${i}`) || r.evidence.includes(`turn ${i + 1}`))
      .map((r) => `${r.label}: ${r.evidence}`);

    return {
      turnIndex: i,
      stage: stageByTurn.get(i),
      sentiment: sentimentEntry?.sentiment,
      sentimentTrigger: sentimentEntry?.trigger,
      flags: flagByTurn.get(i) ?? [],
      corrections: correctionsByTurn.get(i) ?? [],
      rubricEvidence: relatedRubric,
    };
  });
}

export function sentimentChartData(analysis: CallAnalysisScorecard, startIso: string) {
  return analysis.sentiment_arc.map((entry) => ({
    time: formatTime(entry.timestamp, startIso),
    timestamp: entry.timestamp,
    score: sentimentToScore(entry.sentiment),
    sentiment: entry.sentiment,
    trigger: entry.trigger ?? '',
    turnIndex: entry.turn_index,
  }));
}

export const STAGE_COLORS: Record<string, string> = {
  Greeting: '#3b82f6',
  Discovery: '#8b5cf6',
  Resolution: '#22c55e',
  Escalation: '#ef4444',
  Closing: '#64748b',
};

export function trendLabel(trend: string): { label: string; color: string } {
  switch (trend) {
    case 'improving':
      return { label: 'Improving', color: 'var(--color-pass)' };
    case 'deteriorating':
      return { label: 'Deteriorating', color: 'var(--color-fail)' };
    default:
      return { label: 'Stable', color: 'var(--color-text-secondary)' };
  }
}

export function flagType(flag: string): 'dead_air' | 'escalation' | 'other' {
  if (flag.includes('dead_air')) return 'dead_air';
  if (flag.includes('escalation')) return 'escalation';
  return 'other';
}
