import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { setConversationRecording } from '../db/conversationRepository.js';
import { storeRecording } from '../db/recordingStore.js';
import type { ConversationRecording } from '../db/types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('callRecorder');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * The built-in `AgentSession` recorder (`session.start({ record: true })`)
 * intercepts the customer input and agent output audio, mixes them to a stereo
 * stream, and writes a local OGG/Opus file at `${sessionDirectory}/audio.ogg`.
 * We transcode that to MP3 and store it in MongoDB GridFS keyed by `callId`.
 *
 * Best-effort: any failure is persisted on the conversation doc but never
 * thrown, so call shutdown is never blocked.
 */
export async function storeSessionRecording(callId: string, oggPath: string): Promise<void> {
  try {
    if (!existsSync(oggPath)) {
      logger.warn({ callId, oggPath }, 'No recording file found to store');
      await setConversationRecording(callId, {
        status: 'failed',
        format: 'mp3',
        error: 'recording_file_not_found',
      });
      return;
    }

    const mp3 = await transcodeToMp3(oggPath);
    const stored = await storeRecording(callId, mp3);

    const recording: ConversationRecording = {
      status: 'stored',
      format: 'mp3',
      filename: stored.filename,
      gridFsId: stored.gridFsId,
      sizeBytes: stored.sizeBytes,
    };
    await setConversationRecording(callId, recording);

    logger.info(
      { callId, sizeBytes: stored.sizeBytes, gridFsId: stored.gridFsId },
      'Call recording transcoded to MP3 and stored in GridFS',
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown_error';
    logger.error({ err, callId }, 'Failed to store call recording');
    await setConversationRecording(callId, {
      status: 'failed',
      format: 'mp3',
      error,
    }).catch(() => {});
  }
}

async function transcodeToMp3(oggPath: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'novatel-rec-'));
  const outPath = join(dir, 'out.mp3');

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(oggPath)
        .audioCodec('libmp3lame')
        .audioBitrate('96k')
        .format('mp3')
        .on('error', reject)
        .on('end', () => resolve())
        .save(outPath);
    });

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
