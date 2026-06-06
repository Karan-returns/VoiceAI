import type { voice } from '@livekit/agents';
import { voice as voiceNs } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import { ReadableStream } from 'node:stream/web';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('pipeline.tts');

const PRONUNCIATIONS: Record<string, string> = {
  API: 'A P I',
  LiveKit: 'Live Kit',
  URL: 'U R L',
};

function applyPronunciations(text: string): string {
  let result = text;
  for (const [term, spoken] of Object.entries(PRONUNCIATIONS)) {
    result = result.replaceAll(term, spoken);
  }
  return result;
}

function mapReadableStream<T, U>(
  input: ReadableStream<T>,
  mapper: (chunk: T) => U,
): ReadableStream<U> {
  const reader = input.getReader();

  return new ReadableStream<U>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      controller.enqueue(mapper(value));
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export async function runTtsNode(
  agent: voice.Agent,
  text: ReadableStream<string>,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<AudioFrame> | null> {
  logger.debug('Processing TTS input with pronunciation overrides');

  const transformed = mapReadableStream(text, applyPronunciations);
  return voiceNs.Agent.default.ttsNode(agent, transformed, modelSettings);
}
