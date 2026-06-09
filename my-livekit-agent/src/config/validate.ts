import type { AppConfig } from './types.js';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.PRODUCTION === 'true';
}

function requireEnv(key: string): void {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export function validateConfig(config: AppConfig): void {
  if (config.stt.provider === 'deepgram' || config.tts.provider === 'deepgram') {
    requireEnv('DEEPGRAM_API_KEY');
  }

  if (config.llm.provider === 'openai') {
    requireEnv('OPENAI_API_KEY');
  }

  if (config.llm.provider === 'groq') {
    requireEnv('GROQ_API_KEY');
  }

  if (config.llm.provider === 'ollama' && !process.env.OLLAMA_BASE_URL) {
    throw new Error('Missing required environment variable: OLLAMA_BASE_URL');
  }

  const needsMongo =
    config.recording.enabled ||
    process.env.CALL_ANALYSIS_ENABLED !== 'false' ||
    process.env.PROMPT_EVOLUTION_ENABLED === 'true';

  if (isProduction()) {
    requireEnv('LIVEKIT_URL');
    requireEnv('LIVEKIT_API_KEY');
    requireEnv('LIVEKIT_API_SECRET');

    if (needsMongo && !config.mongodbUri) {
      throw new Error(
        'MONGODB_URI is required in production when recording, call analysis, or prompt evolution is enabled',
      );
    }

    if (config.recording.enabled && !config.mongodbUri) {
      throw new Error('MONGODB_URI is required when RECORDING_ENABLED=true');
    }
  }
}
