import { inference } from '@livekit/agents';
import type { stt } from '@livekit/agents';

import type { SttConfig } from '../../config/types.js';

export function createLivekitStt(cfg: SttConfig): stt.STT {
  const model = cfg.model.includes('/') ? cfg.model : `cartesia/${cfg.model}`;
  return inference.STT.fromModelString(`${model}:${cfg.language}`);
}
