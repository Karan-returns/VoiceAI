import type { voice } from '@livekit/agents';
import { voice as voiceNs } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import type { ReadableStream } from 'node:stream/web';

import { createLogger } from '../utils/logger.js';
import { mapStream } from '../utils/streamMap.js';

const logger = createLogger('pipeline.tts');

// term -> spoken form (like a Python dict[str, str] or C++ map<string, string>)
const PRONUNCIATIONS: Record<string, string> = {
  API: 'A P I',
  LiveKit: 'Live Kit',
  URL: 'U R L',
};

function applyPronunciations(text: string): string {
  let result = text;

  for (const term of Object.keys(PRONUNCIATIONS)) {
    const spoken = PRONUNCIATIONS[term];
    if (spoken !== undefined) {
      result = result.replaceAll(term, spoken);
    }
  }

  return result;
}

/**
 * TTS stage of the voice pipeline.
 *
 * Input:  streamed text tokens from the LLM
 * Output: streamed audio frames for playback
 *
 * This stage rewrites technical terms before sending text to the TTS engine.
 */
export async function runTtsNode(
  agent: voice.Agent,
  text: ReadableStream<string>,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<AudioFrame> | null> {
  logger.debug('Processing TTS input with pronunciation overrides');

  const textWithPronunciations = mapStream(text, applyPronunciations);

  return voiceNs.Agent.default.ttsNode(agent, textWithPronunciations, modelSettings);
}
