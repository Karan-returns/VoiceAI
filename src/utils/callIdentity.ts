import type { JobContext } from '@livekit/agents';
import { randomUUID } from 'node:crypto';

export interface CallIdentity {
  callId: string;
  roomName: string;
  jobId: string;
}

/**
 * Room name may be unset until after session.start(); job.id is always available.
 */
export function resolveCallIdentity(ctx: JobContext): CallIdentity {
  const jobId = ctx.job.id?.trim() || randomUUID();
  const roomName = ctx.room.name?.trim() || ctx.job.room?.name?.trim() || '';
  const callId = roomName || jobId;

  return {
    callId,
    roomName: roomName || callId,
    jobId,
  };
}
