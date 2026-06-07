import type { AppConfig } from '../config/types.js';
import type { ConversationDocument } from '../db/types.js';
import { computeHeuristicSignals, formatHeuristicHints, formatTranscript } from './heuristics.js';
import { analyzeCallWithLlm } from './llmAnalyzer.js';
import type { CallAnalysisScorecard } from './types.js';

export async function analyzeConversation(
  config: AppConfig,
  conversation: ConversationDocument,
): Promise<CallAnalysisScorecard> {
  if (conversation.turns.length === 0) {
    throw new Error(`Call ${conversation.callId} has no turns to analyze`);
  }

  const heuristics = computeHeuristicSignals(conversation.turns);
  const transcript = formatTranscript(conversation.turns);
  const heuristicHints = formatHeuristicHints(heuristics);

  return analyzeCallWithLlm(config, {
    callId: conversation.callId,
    transcript,
    heuristicHints,
    promptVersion: conversation.promptVersion,
    heuristics,
    turns: conversation.turns,
  });
}
