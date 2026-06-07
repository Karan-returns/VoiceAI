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
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NovaTelAgent } from './agents/NovaTelAgent.js';
import { config } from './config/index.js';
import { seedBillingAccounts } from './db/billingRepository.js';
import { connectMongo, ensureIndexes } from './db/client.js';
import { NOVATEL_GREETING_INSTRUCTION, NOVATEL_SUPPORT_PROMPT_V1 } from './prompts/novaTelSupport.v1.js';
import { createProviders, type Providers } from './providers/index.js';
import { scheduleCallAnalysis } from './services/callAnalysisService.js';
import { storeSessionRecording } from './services/callRecorder.js';
import { warmupLlm, warmupTts } from './services/connectionWarmup.js';
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

    // Build providers once on the idle worker and warm the LLM + TTS connections
    // BEFORE a call arrives, so the first turn skips the cold-connection penalty
    // (which dominated the LLM TTFT and TTS TTFB averages). The same instances are
    // reused in `entry` so the primed keep-alive connections are the ones used at
    // call time.
    //
    // Fire-and-forget: the cold warmup can take >10s, and prewarm must return within
    // `initializeProcessTimeout` or the worker orphans the process. Running it in the
    // background lets init finish fast while the connections warm on the idle worker.
    const providers = createProviders(config);
    proc.userData.providers = providers;
    void warmupLlm(providers.llm);
    void warmupTts(providers.tts);

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
            minDelay: 280,
            maxDelay: 1800,
          },
          preemptiveGeneration: {
            // Re-enabled: the framework guards correctness for billing turns. It runs
            // onUserTurnCompleted (which injects the billing prefetch) on a copy of the
            // chat context, then discards any preemptive generation whose context
            // snapshot no longer matches (agent_activity isEquivalent check). So on
            // digit/known-account turns the speculative run is dropped and a fresh
            // generation runs WITH the billing data; the speculative run never commits
            // its tool call to the live context (and pruneOrphanToolItems in
            // onUserTurnCompleted + llmNode cleans any stragglers). Non-billing turns —
            // the common case — get the LLM head start.
            //
            // preemptiveTts stays off: LLM TTFT is the dominant cost, and preempting TTS
            // is riskier (audio synthesized before the turn is confirmed).
            enabled: true,
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

      // The built-in AgentSession recorder writes a mixed stereo OGG to the job's
      // session directory. We transcode it to MP3 and store it in GridFS on shutdown.
      // Requires MongoDB (for GridFS) to be configured.
      const recordingEnabled = config.recording.enabled && Boolean(config.mongodbUri);

      if (config.mongodbUri) {
        recorder = attachConversationRecorder(session, config, callIdentity, agentPrompt.version);
        await recorder.start();
      }

      ctx.addShutdownCallback(async () => {
        logUsageSummary(session.usage);

        // Close the session first so the recorder flushes the OGG to disk before
        // we transcode it. close() is idempotent, so this is safe even if the
        // framework already closed the session.
        if (recordingEnabled) {
          await session.close().catch(() => {});
        }

        if (recorder) {
          await recorder.finalize('completed', 'job_shutdown', session.usage);
        }

        // Transcode the mixed OGG recording to MP3 and store it in GridFS.
        // Best-effort: storeSessionRecording never throws, so it can't block shutdown.
        if (recordingEnabled) {
          const oggPath = join(ctx.sessionDirectory, 'audio.ogg');
          await storeSessionRecording(callIdentity.callId, oggPath);
        }
      });

      // Ensure the room is connected (kicked off at the top of entry) before starting
      // the session pipeline.
      await connectPromise;
      const roomConnectedMs = Date.now() - entryStartedAt;

      // `record: true` wires up the in-process RecorderIO (local audio.ogg) AND tells
      // LiveKit Cloud to upload session telemetry on shutdown. When the Cloud project
      // has data recording disabled, that upload fails with 401. Neutralize Cloud-only
      // steps while keeping the local recorder.
      if (recordingEnabled) {
        ctx.initRecording = async () => {};
      }

      const sessionStartAt = Date.now();
      await session.start({
        agent,
        room: ctx.room,
        // Enable the built-in in-process recorder (mixed customer + agent audio).
        record: recordingEnabled,
        inputOptions: {
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });

      // RecorderIO is already started; clearing the flag skips Cloud session-report
      // upload at job end without affecting the local OGG → MP3 → GridFS pipeline.
      if (recordingEnabled) {
        session._enableRecording = false;
      }
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
