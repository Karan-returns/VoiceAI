import { waitForParticipant, waitForTrackPublication } from '@livekit/agents';
import { TrackKind, type Room } from '@livekit/rtc-node';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('callerReady');

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Block until a remote participant has joined and their microphone track is
 * subscribed. AgentSession opens a long-lived STT websocket as soon as it
 * starts; if no audio frames flow yet, LiveKit Inference closes that session
 * with code 2007 ("session closed due to agent inactivity") and the call dies.
 */
export async function waitForCallerAudio(
  room: Room,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await waitForParticipant({ room, signal: controller.signal });
    await waitForTrackPublication({
      room,
      kind: TrackKind.KIND_AUDIO,
      waitForSubscription: true,
      signal: controller.signal,
    });
    logger.info({ waitMs: Date.now() - startedAt }, 'Caller microphone ready');
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for caller microphone (connect in Playground and allow mic access)`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
