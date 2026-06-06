import type { AppConfig } from '../config/types.js';
import { createLlm } from './llm/index.js';
import { createStt } from './stt/index.js';
import { createTts } from './tts/index.js';

/** Factory that builds the three AI service clients from config (like a DI container). */
export function createProviders(cfg: AppConfig) {
  return {
    stt: createStt(cfg.stt),
    llm: createLlm(cfg.llm),
    tts: createTts(cfg.tts),
  };
}

export { createStt } from './stt/index.js';
export { createLlm } from './llm/index.js';
export { createTts } from './tts/index.js';
