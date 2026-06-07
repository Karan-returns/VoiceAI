import type { stt } from '@livekit/agents';

import type { SttConfig } from '../../config/types.js';
import { createAssemblyAiStt } from './assemblyai.js';
import { createDeepgramStt } from './deepgram.js';
import { createLivekitStt } from './livekit.js';
import { createWhisperStt } from './whisper.js';

export function createStt(cfg: SttConfig): stt.STT {
  switch (cfg.provider) {
    case 'livekit':
      return createLivekitStt(cfg);
    case 'deepgram':
      return createDeepgramStt(cfg);
    case 'assemblyai':
      return createAssemblyAiStt(cfg);
    case 'whisper':
      return createWhisperStt(cfg);
    default: {
      const exhaustive: never = cfg.provider;
      throw new Error(`Unsupported STT provider: ${exhaustive}`);
    }
  }
}
