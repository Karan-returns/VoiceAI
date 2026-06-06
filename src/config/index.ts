import 'dotenv/config';

import type { AppConfig, LlmProvider, SttProvider, TtsProvider } from './types.js';

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return fallback;
  }
  return value === 'true' || value === '1';
}

function envNumber(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function asSttProvider(value: string): SttProvider {
  if (value === 'deepgram' || value === 'assemblyai' || value === 'whisper') {
    return value;
  }
  throw new Error(`Invalid STT_PROVIDER: ${value}`);
}

function asLlmProvider(value: string): LlmProvider {
  if (value === 'openai' || value === 'groq' || value === 'ollama' || value === 'livekit') {
    return value;
  }
  throw new Error(`Invalid LLM_PROVIDER: ${value}`);
}

function asTtsProvider(value: string): TtsProvider {
  if (
    value === 'deepgram' ||
    value === 'cartesia' ||
    value === 'elevenlabs' ||
    value === 'livekit'
  ) {
    return value;
  }
  throw new Error(`Invalid TTS_PROVIDER: ${value}`);
}

export const config: AppConfig = {
  stt: {
    provider: asSttProvider(env('STT_PROVIDER', 'deepgram')),
    model: env('STT_MODEL', 'nova-2-general'),
    language: env('STT_LANGUAGE', 'en'),
  },
  llm: {
    provider: asLlmProvider(env('LLM_PROVIDER', 'livekit')),
    model: env('LLM_MODEL', 'openai/gpt-4o-mini'),
    temperature: envNumber('LLM_TEMPERATURE', 0.7),
  },
  tts: {
    provider: asTtsProvider(env('TTS_PROVIDER', 'deepgram')),
    model: env('TTS_MODEL', 'aura-asteria-en'),
    voice: env('TTS_VOICE', 'aura-asteria-en'),
  },
  pipeline: {
    removeFillerWords: envBool('REMOVE_FILLER_WORDS', true),
  },
  logLevel: env('LOG_LEVEL', 'info'),
};

export type { AppConfig } from './types.js';
