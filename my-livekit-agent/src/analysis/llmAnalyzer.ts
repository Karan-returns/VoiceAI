import type { AppConfig } from '../config/types.js';
import { completeWithLlm, parseJsonFromLlm } from '../utils/llmComplete.js';
import {
  CALL_ANALYSIS_SYSTEM_PROMPT_V1,
  buildCallAnalysisUserPrompt,
} from '../prompts/callAnalysis.v1.js';
import { normalizeAnalysisPayload } from './normalize.js';
import {
  CallAnalysisScorecardSchema,
  type CallAnalysisScorecard,
  type HeuristicSignals,
} from './types.js';
import type { ConversationTurn } from '../db/types.js';

export async function analyzeCallWithLlm(
  config: AppConfig,
  input: {
    callId: string;
    transcript: string;
    heuristicHints: string;
    promptVersion: string;
    heuristics: HeuristicSignals;
    turns: ConversationTurn[];
  },
): Promise<CallAnalysisScorecard> {
  const model = `${config.llm.provider}/${config.llm.model}`;
  const userPrompt = buildCallAnalysisUserPrompt(
    input.callId,
    input.transcript,
    input.heuristicHints,
    input.promptVersion,
    model,
  );

  const raw = await completeWithLlm(config, CALL_ANALYSIS_SYSTEM_PROMPT_V1, userPrompt, {
    temperature: 0.2,
  });

  const parsed = parseJsonFromLlm<Record<string, unknown>>(raw);
  const normalized = normalizeAnalysisPayload(parsed, {
    callId: input.callId,
    promptVersion: input.promptVersion,
    model,
    heuristics: input.heuristics,
    turns: input.turns,
  });

  return CallAnalysisScorecardSchema.parse(normalized);
}
