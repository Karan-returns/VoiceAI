import 'dotenv/config';

import { initializeLogger } from '@livekit/agents';

import { config } from '../config/index.js';
import { connectMongo, disconnectMongo, ensureIndexes } from '../db/client.js';
import {
  analyzeAllPendingCalls,
  analyzeConversationByCallId,
} from '../services/callAnalysisService.js';

async function main(): Promise<void> {
  initializeLogger({ pretty: true, level: config.logLevel });

  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is required for call analysis');
  }

  await connectMongo(config.mongodbUri);
  await ensureIndexes();

  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run analyze:call -- <callId>');
    console.error('       npm run analyze:call -- --all');
    process.exit(1);
  }

  if (arg === '--all') {
    const count = await analyzeAllPendingCalls();
    console.log(`Analyzed ${count} pending call(s)`);
  } else {
    await analyzeConversationByCallId(arg);
    console.log(`Analysis completed for call ${arg}`);
  }

  await disconnectMongo();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
