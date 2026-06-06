import { config } from '../config/index.js';
import { analyzeCall } from '../analysis/pipeline.js';
import type { CallAnalysisScorecard } from '../analysis/types.js';
import {
  getConversationByCallId,
  saveCallAnalysis,
  setAnalysisStatus,
} from '../db/conversationRepository.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('callAnalysisService');

export async function analyzeConversationByCallId(callId: string): Promise<CallAnalysisScorecard> {
  const conversation = await getConversationByCallId(callId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${callId}`);
  }

  if (conversation.turns.length === 0) {
    throw new Error(`Conversation ${callId} has no turns to analyze`);
  }

  await setAnalysisStatus(callId, 'pending');

  try {
    const scorecard = await analyzeCall(callId, conversation.turns, config.llm);
    await saveCallAnalysis(callId, scorecard);
    return scorecard;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    await setAnalysisStatus(callId, 'failed', message);
    throw err;
  }
}

export function scheduleCallAnalysis(callId: string): void {
  if (!config.callAnalysisEnabled) {
    logger.debug({ callId }, 'Call analysis disabled — skipping');
    return;
  }

  if (!config.mongodbUri) {
    return;
  }

  void analyzeConversationByCallId(callId).catch((err) => {
    logger.error({ err, callId }, 'Background call analysis failed');
  });
}
