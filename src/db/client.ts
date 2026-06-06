import { MongoClient, type Db } from 'mongodb';

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
  await database.collection('conversations').createIndex({ analysisStatus: 1 });
}
