import { config } from '../../config/index.js';
import {
  getConversationByCallId,
  setPromptEvolutionStatus,
} from '../../db/conversationRepository.js';
import {
  getActivePrompt,
  nextPromptVersion,
  savePromptVersion,
} from '../../db/promptRepository.js';
import type { PromptEvolutionStatus } from '../../db/promptTypes.js';
import { createLogger } from '../../utils/logger.js';
import { extractRecurringFailures, selectFailuresForPatch } from './failureExtraction.js';
import { generatePromptPatch } from './patchGeneration.js';

const logger = createLogger('promptEvolution');

export function isPromptEvolutionEnabled(): boolean {
  const flag = process.env.PROMPT_EVOLUTION_ENABLED;
  return flag === undefined || flag === 'true' || flag === '1';
}

export async function evolvePromptAfterCall(callId: string): Promise<PromptEvolutionStatus> {
  if (!isPromptEvolutionEnabled()) {
    logger.debug({ callId }, 'Prompt evolution disabled');
    return 'skipped';
  }

  try {
    const conversation = await getConversationByCallId(callId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${callId}`);
    }

    if (conversation.analysisStatus !== 'completed' || !conversation.analysis) {
      throw new Error(`Call ${callId} has no completed analysis — run analysis first`);
    }

    const failures = extractRecurringFailures({
      ...(conversation.corrections ? { corrections: conversation.corrections } : {}),
      analysis: conversation.analysis,
      minCorrectionRepeats: Number(process.env.MIN_CORRECTION_REPEAT_COUNT ?? 2),
    });

    const selected = selectFailuresForPatch(failures);
    if (selected.length === 0) {
      logger.info({ callId }, 'No recurring failures — skipping prompt evolution');
      await setPromptEvolutionStatus(callId, 'skipped');
      return 'skipped';
    }

    const activePrompt = await getActivePrompt();
    if (!activePrompt) {
      throw new Error('No active prompt in database — seed prompt on worker prewarm');
    }

    const { proposal, patchedContent } = await generatePromptPatch(
      config,
      activePrompt.content,
      selected,
    );

    const newVersion = nextPromptVersion(activePrompt.version);
    await savePromptVersion({
      version: newVersion,
      content: patchedContent,
      previousContent: activePrompt.content,
      parentVersion: activePrompt.version,
      triggeredByCallId: callId,
      patchSummary: proposal.rationale,
      sectionPatched: proposal.section_heading,
      failuresAddressed: proposal.failures_addressed,
      isActive: true,
      createdAt: new Date(),
    });

    await setPromptEvolutionStatus(callId, 'completed', {
      fromVersion: activePrompt.version,
      toVersion: newVersion,
      sectionPatched: proposal.section_heading,
      patchSummary: proposal.rationale,
      failuresAddressed: proposal.failures_addressed,
    });

    logger.info(
      {
        callId,
        fromVersion: activePrompt.version,
        toVersion: newVersion,
        section: proposal.section_heading,
        failures: selected.length,
      },
      'Prompt evolved and saved for next call',
    );

    return 'completed';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.error({ err, callId }, 'Prompt evolution failed');
    await setPromptEvolutionStatus(callId, 'failed', { error: message }).catch(() => undefined);
    return 'failed';
  }
}

export function schedulePromptEvolution(callId: string): void {
  void evolvePromptAfterCall(callId).catch((err) => {
    logger.error({ err, callId }, 'Unhandled prompt evolution error');
  });
}

export { extractRecurringFailures, selectFailuresForPatch } from './failureExtraction.js';
export { generatePromptPatch } from './patchGeneration.js';
