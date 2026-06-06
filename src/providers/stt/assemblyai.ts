import * as assemblyai from '@livekit/agents-plugin-assemblyai';
import type { stt } from '@livekit/agents';

import type { SttConfig } from '../../config/types.js';

export function createAssemblyAiStt(cfg: SttConfig): stt.STT {
  return new assemblyai.STT({
    speechModel: cfg.model as assemblyai.STTModels,
    languageDetection: cfg.language === 'auto',
  });
}
