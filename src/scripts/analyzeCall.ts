import 'dotenv/config';

import { config } from '../config/index.js';
import { connectMongo, disconnectMongo } from '../db/client.js';
import { listConversationsPendingAnalysis } from '../db/conversationRepository.js';
import { analyzeConversationByCallId } from '../services/callAnalysisService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('scripts.analyzeCall');

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const callIdArg = args.find((arg) => !arg.startsWith('--'));
  const analyzeAll = args.includes('--all');

  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is required to run call analysis');
  }

  await connectMongo(config.mongodbUri);

  try {
    if (callIdArg) {
      const scorecard = await analyzeConversationByCallId(callIdArg);
      console.log(JSON.stringify(scorecard, null, 2));
      return;
    }

    if (analyzeAll) {
      const pending = await listConversationsPendingAnalysis(50);
      if (pending.length === 0) {
        console.log('No conversations pending analysis.');
        return;
      }

      for (const conversation of pending) {
        try {
          const scorecard = await analyzeConversationByCallId(conversation.callId);
          console.log(
            JSON.stringify({
              call_id: scorecard.call_id,
              rubric_score: scorecard.rubric_score,
              flags: scorecard.flags,
            }),
          );
        } catch (err) {
          logger.error({ err, callId: conversation.callId }, 'Failed to analyze conversation');
        }
      }
      return;
    }

    console.log(`Usage:
  npm run analyze:call -- <callId>     Analyze one conversation by callId
  npm run analyze:call -- --all        Analyze all pending completed conversations`);
  } finally {
    await disconnectMongo();
  }
}

main().catch((err) => {
  logger.error({ err }, 'analyzeCall script failed');
  process.exitCode = 1;
});
