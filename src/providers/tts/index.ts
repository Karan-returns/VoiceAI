import type { tts } from '@livekit/agents';

import type { TtsConfig } from '../../config/types.js';
import { createCartesiaTts } from './cartesia.js';
import { createDeepgramTts } from './deepgram.js';
import { createElevenLabsTts } from './elevenlabs.js';
import { createLivekitTts } from './livekit.js';

export function createTts(cfg: TtsConfig): tts.TTS {
  switch (cfg.provider) {
    case 'deepgram':
      return createDeepgramTts(cfg);
    case 'cartesia':
      return createCartesiaTts(cfg);
    case 'elevenlabs':
      return createElevenLabsTts(cfg);
    case 'livekit':
      return createLivekitTts(cfg);
    default: {
      const exhaustive: never = cfg.provider;
      throw new Error(`Unsupported TTS provider: ${exhaustive}`);
    }
  }
}
