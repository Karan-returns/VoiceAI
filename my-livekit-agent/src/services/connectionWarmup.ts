import { llm as llmNs } from '@livekit/agents';
import type { llm } from '@livekit/agents';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('warmup');

/**
 * Prime the LLM network path (DNS, TLS, HTTP keep-alive to the inference gateway)
 * with a throwaway one-token completion so the first real turn does not pay the
 * cold-connection penalty (logs showed first-call ttftMs ~7000ms).
 *
 * Best-effort: any failure is swallowed so warmup can never block worker readiness
 * or fail a call. Reuse the SAME llm instance for the session so the kept-alive
 * connection primed here is the one used at call time.
 */
export async function warmupLlm(model: llm.LLM, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();
  try {
    const chatCtx = llmNs.ChatContext.empty();
    chatCtx.addMessage({ role: 'user', content: 'ping' });

    const stream = model.chat({
      chatCtx,
      connOptions: { maxRetry: 0, retryIntervalMs: 0, timeoutMs },
    });

    // First chunk is enough to confirm the connection (and model) are warm.
    await stream.next();
    stream.close();

    logger.info({ warmupMs: Date.now() - startedAt }, 'LLM connection warmed');
  } catch (err) {
    logger.warn({ err, warmupMs: Date.now() - startedAt }, 'LLM warmup skipped (non-fatal)');
  }
}
