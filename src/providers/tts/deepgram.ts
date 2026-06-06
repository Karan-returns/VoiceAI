import * as deepgram from '@livekit/agents-plugin-deepgram';
import type { tts } from '@livekit/agents';

import type { TtsConfig } from '../../config/types.js';

export function createDeepgramTts(cfg: TtsConfig): tts.TTS {
  const model = (cfg.voice || cfg.model) as 'aura-asteria-en';

  return new deepgram.TTS({
    model,
  });
}
