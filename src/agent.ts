import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import { fileURLToPath } from 'node:url';

import { NovaTelAgent } from './agents/NovaTelAgent.js';
import { config } from './config/index.js';
import { NOVATEL_GREETING_INSTRUCTION } from './prompts/novaTelSupport.v1.js';
import { createProviders } from './providers/index.js';
import { createLogger } from './utils/logger.js';
import { attachSessionMetrics, logUsageSummary } from './utils/metrics.js';

const logger = createLogger('agent');

/**
 * Worker entrypoint.
 *
 * Lifecycle:
 *   1. prewarm()  -> load shared models once per worker process
 *   2. entry()    -> run one call/session when LiveKit dispatches a room job
 */
export default defineAgent({
  // Called once when the worker process starts (like loading a heavy model at startup).
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  // Called once per incoming call/room job.
  entry: async (ctx: JobContext) => {
    try {
      const providers = createProviders(config);
      const agent = new NovaTelAgent(config.pipeline);

      const session = new voice.AgentSession({
        vad: ctx.proc.userData.vad! as silero.VAD,
        stt: providers.stt,
        llm: providers.llm,
        tts: providers.tts,
        ttsTextTransforms: ['filter_markdown', 'filter_emoji'],
        turnHandling: {
          turnDetection: 'stt',
          interruption: {
            enabled: true,
            resumeFalseInterruption: true,
            falseInterruptionTimeout: 800,
            mode: 'adaptive',
          },
          endpointing: {
            mode: 'dynamic',
            minDelay: 250,
            maxDelay: 2000,
          },
          preemptiveGeneration: {
            enabled: true,
            preemptiveTts: true,
          },
        },
        useTtsAlignedTranscript: true,
        connOptions: {
          llmConnOptions: { maxRetry: 2, retryIntervalMs: 500, timeoutMs: 15000 },
          sttConnOptions: { maxRetry: 2, retryIntervalMs: 300, timeoutMs: 10000 },
          ttsConnOptions: { maxRetry: 2, retryIntervalMs: 300, timeoutMs: 10000 },
        },
      });

      attachSessionMetrics(session);

      ctx.addShutdownCallback(async () => {
        logUsageSummary(session.usage);
      });

      await session.start({
        agent,
        room: ctx.room,
        inputOptions: {
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });

      logger.info(
        {
          room: ctx.room.name,
          stt: `${config.stt.provider}/${config.stt.model}`,
          llm: `${config.llm.provider}/${config.llm.model}`,
          tts: `${config.tts.provider}/${config.tts.model}`,
        },
        'NovaTel agent session started',
      );

      await session.generateReply({
        instructions: NOVATEL_GREETING_INSTRUCTION,
      });
    } catch (err) {
      logger.error({ err, room: ctx.room.name }, 'Agent session failed');
      throw err;
    }
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
