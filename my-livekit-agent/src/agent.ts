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
import { createProviders, type Providers } from './providers/index.js';
import { scheduleCallAnalysis } from './services/callAnalysisService.js';
import { warmupLlm } from './services/connectionWarmup.js';
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

    // Build providers once on the idle worker and warm the LLM connection BEFORE a
    // call arrives, so the first turn skips the cold-connection penalty. The same
    // instances are reused in `entry` so the primed keep-alive connection is the one
    // used at call time.
    //
    // Fire-and-forget: the cold warmup can take >10s, and prewarm must return within
    // `initializeProcessTimeout` or the worker orphans the process. Running it in the
    // background lets init finish fast while the connection warms on the idle worker.
    const providers = createProviders(config);
    proc.userData.providers = providers;
    void warmupLlm(providers.llm);

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
      const entryStartedAt = Date.now();

      // Connect to the room as early as possible. WebRTC join is the largest single
      // chunk of first-call latency; kicking it off here overlaps it with the DB and
      // session setup below instead of paying it serially inside session.start().
      const connectPromise = ctx.connect();

      // Reuse the providers warmed during prewarm; fall back to a fresh build if the
      // process was started without the prewarm hook (e.g. some test paths).
      const providers =
        (ctx.proc.userData.providers as Providers | undefined) ?? createProviders(config);

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
            minDelay: 400,
            maxDelay: 2500,
          },
          preemptiveGeneration: {
            // Disabled: preemptive LLM runs raced with onUserTurnCompleted and pruned
            // in-flight billing tool outputs, causing silent/failed lookups after digits.
            enabled: false,
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

      // Ensure the room is connected (kicked off at the top of entry) before starting
      // the session pipeline.
      await connectPromise;
      const roomConnectedMs = Date.now() - entryStartedAt;

      const sessionStartAt = Date.now();
      await session.start({
        agent,
        room: ctx.room,
        inputOptions: {
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });
      const sessionStartMs = Date.now() - sessionStartAt;

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
          roomConnectedMs,
          sessionStartMs,
        },
        'NovaTel agent session started',
      );

      const greetingStartAt = Date.now();
      await session.generateReply({
        instructions: NOVATEL_GREETING_INSTRUCTION,
      });
      logger.info(
        { callId: callIdentity.callId, greetingMs: Date.now() - greetingStartAt },
        'Greeting dispatched',
      );
    } catch (err) {
      logger.error({ err, room: ctx.room.name }, 'Agent session failed');

      if (recorder) {
        await recorder.fail(err instanceof Error ? err.message : 'unknown_error');
      }

      throw err;
    }
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    // Dev defaults to 0 idle workers (cold start on every call). Keep one prewarmed
    // so VAD + Mongo are ready before the first test call connects.
    numIdleProcesses: 1,
    // Headroom over the 10s default so VAD load + Mongo connect during prewarm never
    // trips the init timeout (which orphans the process and breaks the next job).
    initializeProcessTimeout: 30_000,
  }),
);
