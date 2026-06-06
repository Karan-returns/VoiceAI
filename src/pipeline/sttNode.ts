import { createTimedString, isTimedString, stt, voice } from '@livekit/agents';
import type { TimedString } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import type { ReadableStream } from 'node:stream/web';

import { createLogger } from '../utils/logger.js';
import { mapStream } from '../utils/streamMap.js';

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

function cleanTranscriptionChunk(chunk: string | TimedString): string | TimedString {
  if (typeof chunk === 'string') {
    const cleanedText = stripFillerWords(chunk);
    logTranscriptCleanup(chunk, cleanedText);
    return cleanedText;
  }

  if (isTimedString(chunk)) {
    const cleanedText = stripFillerWords(chunk.text);
    logTranscriptCleanup(chunk.text, cleanedText);

    return createTimedString({
      text: cleanedText,
      ...(chunk.startTime !== undefined ? { startTime: chunk.startTime } : {}),
      ...(chunk.endTime !== undefined ? { endTime: chunk.endTime } : {}),
      ...(chunk.confidence !== undefined ? { confidence: chunk.confidence } : {}),
      ...(chunk.startTimeOffset !== undefined ? { startTimeOffset: chunk.startTimeOffset } : {}),
      ...(chunk.speakerId !== undefined ? { speakerId: chunk.speakerId } : {}),
    });
  }

  return chunk;
}

/**
 * STT stage: audio frames -> speech events.
 * Uses the framework default with no extra filtering.
 */
export async function runSttNode(
  agent: voice.Agent,
  audio: ReadableStream<AudioFrame>,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<stt.SpeechEvent | string> | null> {
  return voice.Agent.default.sttNode(agent, audio, modelSettings);
}

/**
 * Transcription cleanup stage: raw transcript stream -> cleaned transcript stream.
 *
 * Optional filler-word removal is applied chunk-by-chunk as text arrives.
 */
export async function runTranscriptionNode(
  agent: voice.Agent,
  text: ReadableStream<string | TimedString>,
  modelSettings: voice.ModelSettings,
  removeFillerWords: boolean,
): Promise<ReadableStream<string | TimedString> | null> {
  const processedText = removeFillerWords
    ? mapStream(text, cleanTranscriptionChunk)
    : text;

  return voice.Agent.default.transcriptionNode(agent, processedText, modelSettings);
}
