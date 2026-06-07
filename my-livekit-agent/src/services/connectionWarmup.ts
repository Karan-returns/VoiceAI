import { llm as llmNs } from '@livekit/agents';
import type { llm, tts } from '@livekit/agents';

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

// inference.TTS (and STT) expose a fire-and-forget `prewarm()` that opens a pooled
// websocket to the gateway in the background. It is not on the abstract `tts.TTS`
// type, so we feature-detect it to stay safe for plugin providers (e.g. Cartesia)
// that synthesize over HTTP and have no such method.
type Prewarmable = { prewarm: () => void };

function hasPrewarm(model: unknown): model is Prewarmable {
  return typeof (model as Partial<Prewarmable>).prewarm === 'function';
}

/**
 * Prime the TTS network path (DNS, TLS, websocket handshake to the inference
 * gateway) so the first real turn does not pay the cold-connection penalty
 * (metrics showed first-call TTS ttfb ~3700ms, far above Cartesia sonic-turbo's
 * real ~100-300ms).
 *
 * Uses the inference provider's native `prewarm()`, which opens a connection in
 * the background and parks it in the pool. The SAME tts instance is reused for the
 * session, so that pooled connection is the one consumed at call time (pool hit).
 *
 * Best-effort: any failure is swallowed so warmup can never block worker readiness
 * or fail a call. The inference `synthesize()`/ChunkedStream path is intentionally
 * not used — it is unimplemented for the streaming inference TTS.
 */
export function warmupTts(model: tts.TTS): void {
  if (!hasPrewarm(model)) {
    logger.debug('TTS warmup skipped (provider exposes no prewarm)');
    return;
  }

  try {
    model.prewarm();
    logger.info('TTS connection prewarm initiated');
  } catch (err) {
    logger.warn({ err }, 'TTS warmup skipped (non-fatal)');
  }
}
