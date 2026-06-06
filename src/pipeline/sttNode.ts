import { stt, voice } from '@livekit/agents';
import type { TimedString } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import type { ReadableStream } from 'node:stream/web';

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
 * Transcription stage: raw transcript stream -> transcript stream for the LLM.
 * Uses the framework default with no extra filtering.
 */
export async function runTranscriptionNode(
  agent: voice.Agent,
  text: ReadableStream<string | TimedString>,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<string | TimedString> | null> {
  return voice.Agent.default.transcriptionNode(agent, text, modelSettings);
}
