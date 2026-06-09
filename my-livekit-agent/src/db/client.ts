import { MongoClient, type Db } from 'mongodb';

import { BILLING_ACCOUNTS_COLLECTION } from './billingTypes.js';
import { AGENT_PROMPTS_COLLECTION } from './promptTypes.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('db');

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(uri: string): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(uri);
  await client.connect();

  const dbName = new URL(uri).pathname.replace(/^\//, '') || 'novatel';
  db = client.db(dbName);

  logger.info({ database: dbName }, 'Connected to MongoDB');
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB is not connected. Set MONGODB_URI and restart the worker.');
  }
  return db;
}

export async function disconnectMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB connection closed');
  }
}

export async function ensureIndexes(): Promise<void> {
  const database = getDb();
  await database.collection('conversations').createIndex(
    { callId: 1 },
    {
      unique: true,
      partialFilterExpression: { callId: { $exists: true, $type: 'string' } },
    },
  );
  await database.collection('conversations').createIndex({ jobId: 1 });
  await database.collection('conversations').createIndex({ startedAt: -1 });
  await database.collection('conversations').createIndex({ status: 1 });
  await database.collection(BILLING_ACCOUNTS_COLLECTION).createIndex(
    { accountLastFour: 1 },
    { unique: true },
  );
  await database.collection(AGENT_PROMPTS_COLLECTION).createIndex({ version: 1 }, { unique: true });
  await database.collection(AGENT_PROMPTS_COLLECTION).createIndex({ isActive: 1 });
  await database.collection(AGENT_PROMPTS_COLLECTION).createIndex({ triggeredByCallId: 1 });
  await database.collection(AGENT_PROMPTS_COLLECTION).createIndex({ createdAt: -1 });

  const retentionDays = Number(process.env.DATA_RETENTION_DAYS ?? 0);
  if (retentionDays > 0) {
    const expireAfterSeconds = retentionDays * 24 * 60 * 60;
    await database.collection('conversations').createIndex(
      { endedAt: 1 },
      { expireAfterSeconds, partialFilterExpression: { endedAt: { $type: 'date' } } },
    );
    logger.info({ retentionDays }, 'TTL index enabled on conversations.endedAt');
  }
}
