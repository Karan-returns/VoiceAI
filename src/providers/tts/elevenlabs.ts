import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import type { tts } from '@livekit/agents';

import type { TtsConfig } from '../../config/types.js';

export function createElevenLabsTts(cfg: TtsConfig): tts.TTS {
  return new elevenlabs.TTS({
    model: cfg.model,
    voiceId: cfg.voice,
  });
}
