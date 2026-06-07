import type { ConversationTurn } from '../db/types.js';
import { scoreSentiment } from '../services/midCallCorrection/signals.js';
import type { CallAnalysisScorecard, HeuristicSignals } from './types.js';
import type { SentimentLevel } from '../services/midCallCorrection/types.js';

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function responseLengthAssessment(avgWords: number): 'too_short' | 'balanced' | 'too_long' {
  if (avgWords < 15) {
    return 'too_short';
  }
  if (avgWords > 60) {
    return 'too_long';
  }
  return 'balanced';
}

function normalizeSentimentTrend(value: unknown): CallAnalysisScorecard['sentiment_trend'] {
  if (value === 'improving' || value === 'stable' || value === 'deteriorating') {
    return value;
  }
  return 'stable';
}

function normalizeSentimentArc(
  raw: unknown,
  turns: ConversationTurn[],
): CallAnalysisScorecard['sentiment_arc'] {
  const customerTurns = turns
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => turn.role === 'customer');

  if (Array.isArray(raw) && raw.length > 0) {
    const normalized = raw
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const fallbackTurn = customerTurns[index]?.turn;
        const fallbackIndex = customerTurns[index]?.index ?? index;
        const sentiment = record.sentiment as SentimentLevel;
        if (
          sentiment !== 'positive' &&
          sentiment !== 'neutral' &&
          sentiment !== 'frustrated' &&
          sentiment !== 'angry'
        ) {
          return null;
        }
        return {
          turn_index: typeof record.turn_index === 'number' ? record.turn_index : fallbackIndex,
          role: 'customer' as const,
          sentiment,
          timestamp:
            typeof record.timestamp === 'string'
              ? record.timestamp
              : (fallbackTurn?.timestamp.toISOString() ?? new Date().toISOString()),
          ...(typeof record.trigger === 'string' ? { trigger: record.trigger } : {}),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return customerTurns.map(({ turn, index }) => ({
    turn_index: index,
    role: 'customer' as const,
    sentiment: scoreSentiment(turn.content),
    timestamp: turn.timestamp.toISOString(),
  }));
}

function normalizeCallFlow(
  raw: unknown,
  turns: ConversationTurn[],
): CallAnalysisScorecard['call_flow'] {
  const agentTurns = turns
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => turn.role === 'agent');

  if (!Array.isArray(raw) || raw.length === 0) {
    return agentTurns.map(({ turn, index }, flowIndex) => ({
      turn_index: index,
      stage: flowIndex === 0 ? 'Greeting' : 'Resolution',
      agent_text_preview: turn.content.slice(0, 120),
    }));
  }

  return raw.map((entry, index) => {
    const agent = agentTurns[index]?.turn;
    const turnIndex = agentTurns[index]?.index ?? index;

    if (typeof entry === 'string') {
      return {
        turn_index: turnIndex,
        stage: entry,
        agent_text_preview: agent?.content.slice(0, 120) ?? '',
      };
    }

    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      return {
        turn_index: typeof record.turn_index === 'number' ? record.turn_index : turnIndex,
        stage: typeof record.stage === 'string' ? record.stage : 'Unknown',
        agent_text_preview:
          typeof record.agent_text_preview === 'string'
            ? record.agent_text_preview
            : (agent?.content.slice(0, 120) ?? ''),
      };
    }

    return {
      turn_index: turnIndex,
      stage: 'Unknown',
      agent_text_preview: agent?.content.slice(0, 120) ?? '',
    };
  });
}

const RUBRIC_PASS_THRESHOLD = 12;

function normalizeRubric(raw: unknown): CallAnalysisScorecard['rubric'] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      if (typeof record.id !== 'string' || typeof record.label !== 'string') {
        return null;
      }
      const rawScore =
        typeof record.score === 'number' ? record.score : record.passed ? 20 : 0;
      // Clamp to the per-item 0-20 range so a hallucinated score can't skew the total.
      const score = Math.max(0, Math.min(20, Math.round(rawScore)));
      // Derive pass/fail from the score so the UI checkmark always matches the number shown.
      const passed = score >= RUBRIC_PASS_THRESHOLD;
      return {
        id: record.id,
        label: record.label,
        passed,
        score,
        evidence: typeof record.evidence === 'string' ? record.evidence : '',
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export function normalizeAnalysisPayload(
  parsed: Record<string, unknown>,
  input: {
    callId: string;
    promptVersion: string;
    model: string;
    heuristics: HeuristicSignals;
    turns: ConversationTurn[];
  },
): Record<string, unknown> {
  const rubric = normalizeRubric(parsed.rubric);
  // Always derive the headline score from the (clamped) item scores so the ring matches the
  // rubric breakdown the user sees, regardless of any rubric_score the model reports.
  const rubricScore = rubric.reduce((sum, item) => sum + item.score, 0);

  const rawSignals =
    parsed.agent_signals && typeof parsed.agent_signals === 'object'
      ? (parsed.agent_signals as Record<string, unknown>)
      : {};

  const avgWords =
    typeof rawSignals.avg_response_words === 'number'
      ? rawSignals.avg_response_words
      : input.heuristics.avg_response_words;

  return {
    call_id: input.callId,
    rubric_score: rubricScore,
    rubric,
    sentiment_arc: normalizeSentimentArc(parsed.sentiment_arc, input.turns),
    sentiment_trend: normalizeSentimentTrend(parsed.sentiment_trend),
    call_flow: normalizeCallFlow(parsed.call_flow, input.turns),
    flags: [
      ...new Set([
        ...normalizeStringArray(parsed.flags),
        ...input.heuristics.dead_air_flags,
        ...input.heuristics.escalation_flags,
      ]),
    ],
    agent_signals: {
      filler_words:
        typeof rawSignals.filler_words === 'number'
          ? rawSignals.filler_words
          : input.heuristics.filler_words,
      avg_response_words: avgWords,
      unresolved_objections:
        typeof rawSignals.unresolved_objections === 'number'
          ? rawSignals.unresolved_objections
          : input.heuristics.unresolved_objections_hint,
      response_length_assessment:
        rawSignals.response_length_assessment === 'too_short' ||
        rawSignals.response_length_assessment === 'balanced' ||
        rawSignals.response_length_assessment === 'too_long'
          ? rawSignals.response_length_assessment
          : responseLengthAssessment(avgWords),
    },
    improvement_areas: normalizeStringArray(parsed.improvement_areas),
    analyzed_at:
      typeof parsed.analyzed_at === 'string' ? parsed.analyzed_at : new Date().toISOString(),
    prompt_version: input.promptVersion,
    model: input.model,
  };
}
