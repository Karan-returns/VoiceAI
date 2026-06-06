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
import { seedBillingAccounts } from './db/billingRepository.js';
import { connectMongo, ensureIndexes } from './db/client.js';
import { NOVATEL_GREETING_INSTRUCTION } from './prompts/novaTelSupport.v1.js';
import { createProviders } from './providers/index.js';
import {
  attachConversationRecorder,
  type ConversationRecorder,
} from './services/conversationRecorder.js';
import { resolveCallIdentity } from './utils/callIdentity.js';
import { createLogger } from './utils/logger.js';
import { attachSessionMetrics, logUsageSummary } from './utils/metrics.js';

const logger = createLogger('agent');

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();

    if (config.mongodbUri) {
      await connectMongo(config.mongodbUri);
      await ensureIndexes();
      await seedBillingAccounts();
    } else {
      logger.warn('MONGODB_URI not set — conversations and billing lookups will not work');
    }
  },

  entry: async (ctx: JobContext) => {
    let recorder: ConversationRecorder | undefined;

    try {
      const providers = createProviders(config);
      const agent = new NovaTelAgent();

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

      const callIdentity = resolveCallIdentity(ctx);

      if (config.mongodbUri) {
        recorder = attachConversationRecorder(session, config, callIdentity);
        await recorder.start();
      }

      ctx.addShutdownCallback(async () => {
        logUsageSummary(session.usage);

        if (recorder) {
          await recorder.finalize('completed', 'job_shutdown', session.usage);
        }
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
          callId: callIdentity.callId,
          room: callIdentity.roomName,
          jobId: callIdentity.jobId,
          stt: `${config.stt.provider}/${config.stt.model}`,
          llm: `${config.llm.provider}/${config.llm.model}`,
          tts: `${config.tts.provider}/${config.tts.model}`,
          mongo: Boolean(config.mongodbUri),
        },
        'NovaTel agent session started',
      );

      await session.generateReply({
        instructions: NOVATEL_GREETING_INSTRUCTION,
      });
    } catch (err) {
      logger.error({ err, room: ctx.room.name }, 'Agent session failed');

      if (recorder) {
        await recorder.fail(err instanceof Error ? err.message : 'unknown_error');
      }

      throw err;
    }
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
