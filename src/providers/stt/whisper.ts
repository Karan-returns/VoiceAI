import * as openai from '@livekit/agents-plugin-openai';
import type { stt } from '@livekit/agents';

import type { SttConfig } from '../../config/types.js';

export function createWhisperStt(cfg: SttConfig): stt.STT {
  return new openai.STT({
    model: cfg.model || 'whisper-1',
    language: cfg.language,
  });
}
