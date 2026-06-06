import type { Collection } from 'mongodb';

import { getDb } from './client.js';
import {
  CONVERSATIONS_COLLECTION,
  type ConversationDocument,
  type ConversationTurn,
  type MidCallCorrectionRecord,
} from './types.js';

function conversations(): Collection<ConversationDocument> {
  return getDb().collection<ConversationDocument>(CONVERSATIONS_COLLECTION);
}

export async function createConversation(doc: ConversationDocument): Promise<void> {
  if (!doc.callId?.trim()) {
    throw new Error('Cannot create conversation without a callId');
  }

  await conversations().insertOne(doc);
}

export async function appendTurn(callId: string, turn: ConversationTurn): Promise<void> {
  await conversations().updateOne(
    { callId },
    {
      $push: { turns: turn },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function appendMidCallCorrection(
  callId: string,
  correction: {
    signal: MidCallCorrectionRecord['signal'];
    blockId: MidCallCorrectionRecord['blockId'];
    evidence?: string;
    injectedAt: number;
    latencyMs: number;
    turnIndex: number;
  },
): Promise<void> {
  const record: MidCallCorrectionRecord = {
    signal: correction.signal,
    blockId: correction.blockId,
    injectedAt: new Date(correction.injectedAt),
    latencyMs: correction.latencyMs,
    turnIndex: correction.turnIndex,
    ...(correction.evidence ? { evidence: correction.evidence } : {}),
  };

  await conversations().updateOne(
    { callId },
    {
      $push: { corrections: record },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function finalizeConversation(
  callId: string,
  update: Pick<ConversationDocument, 'endedAt' | 'status' | 'closeReason' | 'usage'>,
): Promise<void> {
  await conversations().updateOne(
    { callId },
    {
      $set: {
        ...update,
        updatedAt: new Date(),
      },
    },
  );
}

export async function markConversationFailed(callId: string, closeReason: string): Promise<void> {
  await finalizeConversation(callId, {
    endedAt: new Date(),
    status: 'failed',
    closeReason,
  });
}
