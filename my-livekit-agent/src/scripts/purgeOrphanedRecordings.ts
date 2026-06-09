/**
 * Remove GridFS recordings that no longer have a matching conversations document.
 * Run periodically (e.g. weekly cron) when DATA_RETENTION_DAYS TTL is enabled.
 *
 * Usage: tsx src/scripts/purgeOrphanedRecordings.ts [--dry-run]
 */
import 'dotenv/config';

import { GridFSBucket, MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const bucketName = 'recordings';

const client = new MongoClient(uri);
await client.connect();
const dbName = new URL(uri).pathname.replace(/^\//, '') || 'novatel';
const db = client.db(dbName);
const gfs = new GridFSBucket(db, { bucketName });

const files = await gfs.find({}).toArray();
let removed = 0;

for (const file of files) {
  const filename = file.filename;
  if (!filename?.endsWith('.mp3')) {
    continue;
  }

  const callId = filename.replace(/\.mp3$/, '');
  const conversation = await db.collection('conversations').findOne({ callId });
  if (conversation) {
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] would delete ${filename} (${file.length ?? 0} bytes)`);
  } else {
    await gfs.delete(file._id);
    console.log(`deleted ${filename}`);
  }
  removed += 1;
}

console.log(`${dryRun ? 'would remove' : 'removed'} ${removed} orphaned recording(s)`);
await client.close();
