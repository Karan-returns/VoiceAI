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
import { NOVATEL_GREETING_INSTRUCTION, NOVATEL_SUPPORT_PROMPT_V1 } from './prompts/novaTelSupport.v1.js';
import { createProviders } from './providers/index.js';
import { scheduleCallAnalysis } from './services/callAnalysisService.js';
import {
  attachConversationRecorder,
  type ConversationRecorder,
} from './services/conversationRecorder.js';
import { attachMidCallCorrection } from './services/midCallCorrection/index.js';
import { ensurePromptSeeded, resolveAgentPrompt } from './services/promptLoader.js';
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
      await ensurePromptSeeded();
    } else {
      logger.warn('MONGODB_URI not set — conversations and billing lookups will not work');
    }
  },

  entry: async (ctx: JobContext) => {
    let recorder: ConversationRecorder | undefined;

    try {
      const providers = createProviders(config);
      const agentPrompt = config.mongodbUri
        ? await resolveAgentPrompt()
        : { content: NOVATEL_SUPPORT_PROMPT_V1, version: 'v1' };
      const agent = new NovaTelAgent(agentPrompt.content);

      const session = new voice.AgentSession({
        vad: ctx.proc.userData.vad! as silero.VAD,
        stt: providers.stt,
        llm: providers.llm,
        tts: providers.tts,
        ttsTextTransforms: ['filter_markdown', 'filter_emoji'],
        turnHandling: {
          // VAD-driven turns avoid STT/VAD desync that leaves the pipeline stuck (no EOU).
          turnDetection: 'vad',
          interruption: {
            enabled: true,
            mode: 'vad',
            resumeFalseInterruption: true,
            falseInterruptionTimeout: 2000,
            minDuration: 600,
            minWords: 2,
          },
          endpointing: {
            mode: 'fixed',
            minDelay: 600,
            maxDelay: 2500,
          },
          preemptiveGeneration: {
            enabled: true,
            // preemptiveTts caused overlapping speech handles and empty interrupted replies.
            preemptiveTts: false,
          },
        },
        useTtsAlignedTranscript: false,
        connOptions: {
          llmConnOptions: { maxRetry: 2, retryIntervalMs: 500, timeoutMs: 15000 },
          sttConnOptions: { maxRetry: 2, retryIntervalMs: 300, timeoutMs: 10000 },
          ttsConnOptions: { maxRetry: 2, retryIntervalMs: 300, timeoutMs: 10000 },
        },
      });

      attachSessionMetrics(session);

      const callIdentity = resolveCallIdentity(ctx);
      attachMidCallCorrection(session, agent, { callId: callIdentity.callId });

      if (config.mongodbUri) {
        recorder = attachConversationRecorder(session, config, callIdentity, agentPrompt.version);
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
          promptVersion: agentPrompt.version,
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
