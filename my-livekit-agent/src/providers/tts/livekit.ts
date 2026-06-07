import { inference } from '@livekit/agents';
import type { tts } from '@livekit/agents';

import type { TtsConfig } from '../../config/types.js';

export function createLivekitTts(cfg: TtsConfig): tts.TTS {
  const model = cfg.model.startsWith('cartesia/') ? cfg.model : `cartesia/${cfg.model}`;

  return new inference.TTS({
    model,
    voice: cfg.voice,
  });
}
