import * as deepgram from '@livekit/agents-plugin-deepgram';
import type { stt } from '@livekit/agents';

import type { SttConfig } from '../../config/types.js';

export function createDeepgramStt(cfg: SttConfig): stt.STT {
  return new deepgram.STT({
    model: cfg.model as 'nova-2-general',
    language: cfg.language,
  });
}
