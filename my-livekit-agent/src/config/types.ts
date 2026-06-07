// Provider names allowed in .env (like Python Literal[...] or C++ enum class).

export type SttProvider = 'livekit' | 'deepgram' | 'assemblyai' | 'whisper';
export type LlmProvider = 'openai' | 'groq' | 'ollama' | 'livekit';
export type TtsProvider = 'deepgram' | 'cartesia' | 'elevenlabs' | 'livekit';

// Plain data containers (like Python dataclass / C++ struct).

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

export interface RecordingConfig {
  /**
   * When true, the built-in AgentSession recorder captures the mixed call audio,
   * which is transcoded to MP3 and stored in MongoDB GridFS. Requires MONGODB_URI.
   */
  enabled: boolean;
}

export interface AppConfig {
  mongodbUri?: string;
  stt: SttConfig;
  llm: LlmConfig;
  tts: TtsConfig;
  recording: RecordingConfig;
  logLevel: string;
}
