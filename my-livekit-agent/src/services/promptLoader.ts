import { NOVATEL_SUPPORT_PROMPT_V1 } from '../prompts/novaTelSupport.v1.js';
import { getActivePrompt, seedPromptIfEmpty, syncSeedPromptContent } from '../db/promptRepository.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('promptLoader');

const SEED_VERSION = 'v1';
const SEED_CALL_ID = 'system_seed';

export async function ensurePromptSeeded(): Promise<void> {
  await seedPromptIfEmpty(SEED_VERSION, NOVATEL_SUPPORT_PROMPT_V1, SEED_CALL_ID);
  await syncSeedPromptContent(SEED_VERSION, NOVATEL_SUPPORT_PROMPT_V1);
}

export async function resolveAgentPrompt(): Promise<{ content: string; version: string }> {
  const active = await getActivePrompt();
  if (active) {
    return { content: active.content, version: active.version };
  }

  logger.warn('No active prompt in DB — falling back to static v1');
  return { content: NOVATEL_SUPPORT_PROMPT_V1, version: SEED_VERSION };
}
