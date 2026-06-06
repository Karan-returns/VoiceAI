import type { LlmConfig } from '../config/types.js';
import type { ConversationTurn } from '../db/types.js';
import { CALL_ANALYSIS_PROMPT_VERSION } from '../prompts/callAnalysis.v1.js';
import { createLogger } from '../utils/logger.js';
import {
  assessResponseLength,
  computeHeuristicSignals,
  formatTranscriptForAnalysis,
} from './heuristics.js';
import { runLlmAnalysis } from './llmAnalyzer.js';
import type { CallAnalysisScorecard } from './types.js';

const logger = createLogger('analysis.pipeline');

export async function analyzeCall(
  callId: string,
  turns: ConversationTurn[],
  llmConfig: LlmConfig,
): Promise<CallAnalysisScorecard> {
  if (turns.length === 0) {
    throw new Error(`Cannot analyze call ${callId}: transcript has no turns`);
  }

  const heuristics = computeHeuristicSignals(turns);
  const transcript = formatTranscriptForAnalysis(turns);

  logger.info(
    {
      callId,
      turns: turns.length,
      fillerWords: heuristics.filler_words,
      deadAir: heuristics.dead_air_flags.length,
      escalations: heuristics.escalation_flags.length,
    },
    'Running call analysis',
  );

  const llmResult = await runLlmAnalysis(transcript, heuristics, llmConfig);

  const rubricScore = llmResult.rubric.reduce((sum, item) => sum + item.score, 0);
  const unresolvedCount = llmResult.unresolved_objections.filter((o) => !o.addressed).length;

  const flags = [
    ...new Set([...heuristics.dead_air_flags, ...heuristics.escalation_flags]),
  ].sort();

  const scorecard: CallAnalysisScorecard = {
    call_id: callId,
    rubric_score: rubricScore,
    rubric: llmResult.rubric,
    sentiment_arc: llmResult.sentiment_arc,
    sentiment_trend: llmResult.sentiment_trend,
    call_flow: llmResult.call_flow,
    flags,
    agent_signals: {
      filler_words: heuristics.filler_words,
      avg_response_words: heuristics.avg_response_words,
      unresolved_objections: unresolvedCount,
      response_length_assessment: assessResponseLength(heuristics.avg_response_words),
    },
    improvement_areas: llmResult.improvement_areas,
    analyzed_at: new Date().toISOString(),
    prompt_version: CALL_ANALYSIS_PROMPT_VERSION,
    model: llmConfig.model,
  };

  logger.info({ callId, rubricScore, flags: flags.length }, 'Call analysis complete');
  return scorecard;
}
