import { createTimedString, isTimedString, stt, voice } from '@livekit/agents';
import type { TimedString } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import { ReadableStream } from 'node:stream/web';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('pipeline.stt');

const FILLER_WORDS = /\b(uh+|um+|erm+|like|you know|i mean)\b/gi;

export function stripFillerWords(text: string): string {
  return text.replace(FILLER_WORDS, '').replace(/\s{2,}/g, ' ').trim();
}

export function shouldRemoveFillerWords(enabled: boolean): boolean {
  return enabled;
}

export function logTranscriptCleanup(before: string, after: string): void {
  if (before !== after) {
    logger.debug({ before, after }, 'Removed filler words from transcript');
  }
}

function mapTranscriptionChunk(chunk: string | TimedString): string | TimedString {
  if (typeof chunk === 'string') {
    const after = stripFillerWords(chunk);
    logTranscriptCleanup(chunk, after);
    return after;
  }

  if (isTimedString(chunk)) {
    const after = stripFillerWords(chunk.text);
    logTranscriptCleanup(chunk.text, after);
    return createTimedString({
      text: after,
      ...(chunk.startTime !== undefined ? { startTime: chunk.startTime } : {}),
      ...(chunk.endTime !== undefined ? { endTime: chunk.endTime } : {}),
      ...(chunk.confidence !== undefined ? { confidence: chunk.confidence } : {}),
      ...(chunk.startTimeOffset !== undefined ? { startTimeOffset: chunk.startTimeOffset } : {}),
      ...(chunk.speakerId !== undefined ? { speakerId: chunk.speakerId } : {}),
    });
  }

  return chunk;
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

export async function runSttNode(
  agent: voice.Agent,
  audio: ReadableStream<AudioFrame>,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<stt.SpeechEvent | string> | null> {
  return voice.Agent.default.sttNode(agent, audio, modelSettings);
}

export async function runTranscriptionNode(
  agent: voice.Agent,
  text: ReadableStream<string | TimedString>,
  modelSettings: voice.ModelSettings,
  removeFillerWords: boolean,
): Promise<ReadableStream<string | TimedString> | null> {
  const stream = removeFillerWords
    ? mapReadableStream(text, mapTranscriptionChunk)
    : text;

  return voice.Agent.default.transcriptionNode(agent, stream, modelSettings);
}
