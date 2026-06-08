import 'dotenv/config';

import type { AppConfig, LlmProvider, SttProvider, TtsProvider } from './types.js';

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
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

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return fallback;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function asSttProvider(value: string): SttProvider {
  if (value === 'livekit' || value === 'deepgram' || value === 'assemblyai' || value === 'whisper') {
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
  ...(process.env.MONGODB_URI ? { mongodbUri: process.env.MONGODB_URI } : {}),
  stt: {
    provider: asSttProvider(env('STT_PROVIDER', 'livekit')),
    model: env('STT_MODEL', 'cartesia/ink-whisper'),
    language: env('STT_LANGUAGE', 'en'),
  },
  llm: {
    provider: asLlmProvider(env('LLM_PROVIDER', 'livekit')),
    model: env('LLM_MODEL', 'openai/gpt-4.1-nano'),
    temperature: envNumber('LLM_TEMPERATURE', 0.55),
  },
  tts: {
    provider: asTtsProvider(env('TTS_PROVIDER', 'livekit')),
    model: env('TTS_MODEL', 'cartesia/sonic-turbo'),
    voice: env('TTS_VOICE', 'f786b574-daa5-4673-aa0c-cbe3e8534c02'),
  },
  recording: {
    enabled: envBool('RECORDING_ENABLED', false),
  },
  logLevel: env('LOG_LEVEL', 'info'),
};

export type { AppConfig } from './types.js';
