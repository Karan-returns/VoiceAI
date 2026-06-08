import { initializeLogger, llm, voice } from '@livekit/agents';

import { NovaTelAgent } from '../agents/NovaTelAgent.js';
import { config } from '../config/index.js';
import { seedBillingAccounts } from '../db/billingRepository.js';
import { connectMongo, disconnectMongo, ensureIndexes } from '../db/client.js';
import { NOVATEL_SUPPORT_PROMPT_V1 } from '../prompts/novaTelSupport.v1.js';
import { createProviders } from '../providers/index.js';
import { warmupLlm, warmupTts } from '../services/connectionWarmup.js';
import {
  average,
  formatMs,
  previewText,
  printLatencyTable,
} from './latencyTable.js';
import { TestAudioOutput, TurnLatencyWatch } from './testAudioOutput.js';

const defaultQuestions = [
  'What is my current bill balance?',
  'My account ends in 5678.',
  'Why was there a late fee on my last bill?',
];

const questions =
  process.argv.length > 2 ? process.argv.slice(2) : defaultQuestions;

interface TurnMetrics {
  turn: number;
  userText: string;
  billingInjected: boolean;
  firstTtsMs: number;
  replyCompleteMs: number;
  firstSpeechSource: string;
}

async function runTurn(
  session: voice.AgentSession,
  agent: NovaTelAgent,
  watch: TurnLatencyWatch,
  turn: number,
  userText: string,
): Promise<TurnMetrics> {
  watch.beginTurn();

  const userMessage = llm.ChatMessage.create({
    role: 'user',
    content: userText,
  });
  const chatCtx = session.chatCtx.copy();

  await agent.onUserTurnCompleted(chatCtx, userMessage);

  const speechHandle = session.generateReply({
    userMessage,
    chatCtx,
    inputModality: 'text',
  });

  await speechHandle.waitForPlayout();
  watch.endTurn();

  const billingInjected = chatCtx.items.some(
    (item) => 'id' in item && item.id === 'lk.billing.prefetch',
  );

  const timing = watch.snapshot();

  return {
    turn,
    userText,
    billingInjected,
    ...timing,
  };
}

function printTurnTable(rows: TurnMetrics[]): void {
  printLatencyTable(
    'Per-turn latency (user turn complete → first TTS audio)',
    [
      { key: 'turn', header: '#', align: 'right', width: 2 },
      { key: 'user', header: 'User', align: 'left', width: 34 },
      { key: 'firstTts', header: 'First TTS', align: 'right', width: 11 },
      { key: 'replyDone', header: 'Reply done', align: 'right', width: 11 },
      { key: 'firstSpeech', header: '1st speech', align: 'left', width: 14 },
      { key: 'billing', header: 'Prefetch', align: 'left', width: 10 },
    ],
    rows.map((row) => ({
      turn: row.turn,
      user: previewText(row.userText),
      firstTts: row.firstTtsMs >= 0 ? formatMs(row.firstTtsMs) : '—',
      replyDone: row.replyCompleteMs >= 0 ? formatMs(row.replyCompleteMs) : '—',
      firstSpeech: row.firstSpeechSource,
      billing: row.billingInjected ? 'yes' : 'no',
    })),
  );
}

function printSummaryTable(rows: TurnMetrics[], warmupMs: number): void {
  const measured = rows.filter((row) => row.firstTtsMs >= 0);

  printLatencyTable(
    'Summary (averages across turns)',
    [
      { key: 'metric', header: 'Metric', align: 'left', width: 34 },
      { key: 'value', header: 'Value', align: 'right', width: 12 },
    ],
    [
      { metric: 'LLM warmup', value: formatMs(warmupMs) },
      {
        metric: 'First TTS after user turn (avg)',
        value: formatMs(average(measured.map((row) => row.firstTtsMs))),
      },
      {
        metric: 'Full reply complete (avg)',
        value: formatMs(average(rows.map((row) => row.replyCompleteMs))),
      },
    ],
  );

  console.log(
    '\nFirst TTS = wall clock from user sentence complete to the first synthesized audio frame.',
  );
  console.log(
    '  Runs the real pipeline: onUserTurnCompleted (filler + billing prefetch) → generateReply (LLM → TTS).',
  );
  console.log(
    `  Providers: STT ${config.stt.provider}/${config.stt.model} | LLM ${config.llm.provider}/${config.llm.model} | TTS ${config.tts.provider}/${config.tts.model}`,
  );
}

async function main(): Promise<void> {
  initializeLogger({ pretty: true, level: config.logLevel });

  if (config.mongodbUri) {
    await connectMongo(config.mongodbUri);
    await ensureIndexes();
    await seedBillingAccounts();
  } else {
    console.warn('MONGODB_URI not set — billing prefetch turns will not inject account data.');
  }

  const providers = createProviders(config);

  const warmupStartedAt = Date.now();
  await warmupLlm(providers.llm);
  warmupTts(providers.tts);
  const warmupMs = Date.now() - warmupStartedAt;

  const agent = new NovaTelAgent(NOVATEL_SUPPORT_PROMPT_V1);
  const testAudio = new TestAudioOutput();

  const session = new voice.AgentSession({
    llm: providers.llm,
    tts: providers.tts,
    turnHandling: {
      interruption: {
        enabled: false,
        resumeFalseInterruption: false,
      },
    },
    connOptions: {
      llmConnOptions: { maxRetry: 2, retryIntervalMs: 500, timeoutMs: 30_000 },
      ttsConnOptions: { maxRetry: 2, retryIntervalMs: 300, timeoutMs: 10_000 },
    },
  });

  session.output.audio = testAudio as unknown as NonNullable<typeof session.output.audio>;

  const watch = new TurnLatencyWatch(session, testAudio);
  const rows: TurnMetrics[] = [];

  session.on(voice.AgentSessionEventTypes.Error, (ev) => {
    console.error(`Session error (${ev.label}):`, ev.error);
  });

  try {
    await session.start({ agent });

    for (const [index, question] of questions.entries()) {
      console.log(`\n--- Turn ${index + 1}: ${question} ---`);
      rows.push(await runTurn(session, agent, watch, index + 1, question));
    }
  } finally {
    watch.close();
  }

  printTurnTable(rows);
  printSummaryTable(rows, warmupMs);

  await session.close();

  if (config.mongodbUri) {
    await disconnectMongo();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
