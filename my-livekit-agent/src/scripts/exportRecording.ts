import 'dotenv/config';

import { initializeLogger } from '@livekit/agents';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

import { config } from '../config/index.js';
import { connectMongo, disconnectMongo } from '../db/client.js';
import { getConversationByCallId } from '../db/conversationRepository.js';
import { getRecordingStream } from '../db/recordingStore.js';

/**
 * Pull a stored call recording out of MongoDB GridFS by callId and write it to
 * disk as an MP3. Doubles as an end-to-end check that recordings were stored.
 *
 *   npm run export:recording -- <callId> [outPath]
 */
async function main(): Promise<void> {
  initializeLogger({ pretty: true, level: config.logLevel });

  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is required to export recordings');
  }

  const callId = process.argv[2];
  if (!callId) {
    console.error('Usage: npm run export:recording -- <callId> [outPath]');
    process.exit(1);
  }
  const outPath = process.argv[3] ?? `${callId}.mp3`;

  await connectMongo(config.mongodbUri);

  const conversation = await getConversationByCallId(callId);
  if (conversation?.recording) {
    console.log('Recording metadata:', conversation.recording);
  } else {
    console.warn(`No recording metadata on conversation ${callId} (continuing to check GridFS)`);
  }

  const stream = await getRecordingStream(callId);
  if (!stream) {
    console.error(`No recording found in GridFS for callId ${callId}`);
    await disconnectMongo();
    process.exit(1);
  }

  await pipeline(stream, createWriteStream(outPath));
  console.log(`Recording written to ${outPath}`);

  await disconnectMongo();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
