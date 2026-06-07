import { GridFSBucket, ObjectId, type GridFSBucketReadStream } from 'mongodb';
import { Readable } from 'node:stream';

import { getDb } from './client.js';
import { RECORDINGS_BUCKET } from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('recordingStore');

function bucket(): GridFSBucket {
  return new GridFSBucket(getDb(), { bucketName: RECORDINGS_BUCKET });
}

export interface StoredRecording {
  gridFsId: string;
  filename: string;
  sizeBytes: number;
}

/**
 * Stream an MP3 buffer into GridFS. Existing recordings for the same callId are
 * removed first so re-runs don't accumulate orphaned files.
 */
export async function storeRecording(callId: string, mp3: Buffer): Promise<StoredRecording> {
  const gfs = bucket();
  const filename = `${callId}.mp3`;

  await deleteRecording(callId);

  const uploadStream = gfs.openUploadStream(filename, {
    metadata: { callId, contentType: 'audio/mpeg' },
  });

  await new Promise<void>((resolve, reject) => {
    Readable.from(mp3).pipe(uploadStream).on('error', reject).on('finish', () => resolve());
  });

  logger.info({ callId, filename, sizeBytes: mp3.length }, 'Recording stored in GridFS');

  return {
    gridFsId: uploadStream.id.toString(),
    filename,
    sizeBytes: mp3.length,
  };
}

export async function deleteRecording(callId: string): Promise<void> {
  const gfs = bucket();
  const existing = await gfs.find({ filename: `${callId}.mp3` }).toArray();
  for (const file of existing) {
    await gfs.delete(file._id as ObjectId);
  }
}

/**
 * Open a readable stream for a stored recording by callId, or null if none exists.
 * Useful for the dashboard / verification scripts.
 */
export async function getRecordingStream(callId: string): Promise<GridFSBucketReadStream | null> {
  const gfs = bucket();
  const files = await gfs.find({ filename: `${callId}.mp3` }).limit(1).toArray();
  if (files.length === 0) {
    return null;
  }
  return gfs.openDownloadStream(files[0]!._id as ObjectId);
}
