export type SttProvider = 'deepgram' | 'assemblyai' | 'whisper';
export type LlmProvider = 'openai' | 'groq' | 'ollama' | 'livekit';
export type TtsProvider = 'deepgram' | 'cartesia' | 'elevenlabs' | 'livekit';

export interface SttConfig {
  provider: SttProvider;
  model: string;
  language: string;
}

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  temperature: number;
}

export interface TtsConfig {
  provider: TtsProvider;
  model: string;
  voice: string;
}

export interface PipelineConfig {
  removeFillerWords: boolean;
}

export interface AppConfig {
  stt: SttConfig;
  llm: LlmConfig;
  tts: TtsConfig;
  pipeline: PipelineConfig;
  logLevel: string;
}
