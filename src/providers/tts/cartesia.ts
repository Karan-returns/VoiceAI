import * as cartesia from '@livekit/agents-plugin-cartesia';
import type { tts } from '@livekit/agents';

import type { TtsConfig } from '../../config/types.js';

export function createCartesiaTts(cfg: TtsConfig): tts.TTS {
  return new cartesia.TTS({
    model: cfg.model,
    voice: cfg.voice,
  });
}
