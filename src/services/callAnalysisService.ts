import { analyzeConversation } from '../analysis/pipeline.js';
import { config } from '../config/index.js';
import {
  getConversationByCallId,
  listConversationsPendingAnalysis,
  saveCallAnalysis,
  setAnalysisStatus,
} from '../db/conversationRepository.js';
import { createLogger } from '../utils/logger.js';
import { evolvePromptAfterCall } from './promptEvolution/index.js';

const logger = createLogger('callAnalysis');

export function isCallAnalysisEnabled(): boolean {
  const flag = process.env.CALL_ANALYSIS_ENABLED;
  return flag === undefined || flag === 'true' || flag === '1';
}

export async function analyzeConversationByCallId(callId: string): Promise<void> {
  const conversation = await getConversationByCallId(callId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${callId}`);
  }

  if (conversation.status !== 'completed') {
    throw new Error(`Call ${callId} is not completed (status=${conversation.status})`);
  }

  await setAnalysisStatus(callId, 'pending');

  try {
    const scorecard = await analyzeConversation(config, conversation);
    await saveCallAnalysis(callId, scorecard);
    logger.info({ callId, rubricScore: scorecard.rubric_score }, 'Call analysis completed');

    const evolutionStatus = await evolvePromptAfterCall(callId);
    logger.info({ callId, evolutionStatus }, 'Prompt evolution finished');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    await setAnalysisStatus(callId, 'failed', message);
    logger.error({ err, callId }, 'Call analysis failed');
    throw err;
  }
}

export function scheduleCallAnalysis(callId: string): void {
  if (!isCallAnalysisEnabled()) {
    logger.debug({ callId }, 'Call analysis disabled');
    return;
  }

  void analyzeConversationByCallId(callId).catch((err) => {
    logger.error({ err, callId }, 'Unhandled call analysis error');
  });
}

export async function analyzeAllPendingCalls(): Promise<number> {
  const pending = await listConversationsPendingAnalysis();
  for (const doc of pending) {
    await analyzeConversationByCallId(doc.callId);
  }
  return pending.length;
}
