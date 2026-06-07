import type { Collection } from 'mongodb';

import { getDb } from './client.js';
import type { CallAnalysisScorecard } from '../analysis/types.js';
import type { AnalysisStatus } from '../analysis/types.js';
import {
  CONVERSATIONS_COLLECTION,
  type ConversationDocument,
  type ConversationTurn,
  type MidCallCorrectionRecord,
} from './types.js';
import type { PromptEvolutionStatus } from './promptTypes.js';

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

export async function getConversationByCallId(callId: string): Promise<ConversationDocument | null> {
  return conversations().findOne({ callId });
}

export async function saveCallAnalysis(
  callId: string,
  analysis: CallAnalysisScorecard,
): Promise<void> {
  await conversations().updateOne(
    { callId },
    {
      $set: {
        analysis,
        analysisStatus: 'completed' satisfies AnalysisStatus,
        updatedAt: new Date(),
      },
      $unset: { analysisError: '' },
    },
  );
}

export async function setAnalysisStatus(
  callId: string,
  status: AnalysisStatus,
  error?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    analysisStatus: status,
    updatedAt: new Date(),
  };
  if (error) {
    update.analysisError = error;
  }

  await conversations().updateOne({ callId }, { $set: update });
}

export async function setPromptEvolutionStatus(
  callId: string,
  status: PromptEvolutionStatus,
  detail?: ConversationDocument['promptEvolution'],
): Promise<void> {
  await conversations().updateOne(
    { callId },
    {
      $set: {
        promptEvolutionStatus: status,
        ...(detail ? { promptEvolution: detail } : {}),
        updatedAt: new Date(),
      },
    },
  );
}

export async function listConversationsPendingAnalysis(): Promise<ConversationDocument[]> {
  return conversations()
    .find({
      status: 'completed',
      $or: [{ analysisStatus: { $exists: false } }, { analysisStatus: 'pending' }],
    })
    .sort({ endedAt: -1 })
    .toArray();
}

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  analysisStatus?: AnalysisStatus;
  hasAnalysis?: boolean;
}

export async function listConversations(
  options: ListConversationsOptions = {},
): Promise<{ calls: ConversationDocument[]; total: number }> {
  const { limit = 50, offset = 0, analysisStatus, hasAnalysis } = options;

  const filter: Record<string, unknown> = { status: 'completed' };
  if (analysisStatus) {
    filter.analysisStatus = analysisStatus;
  }
  if (hasAnalysis === true) {
    filter.analysis = { $exists: true };
  }

  const collection = conversations();
  const [calls, total] = await Promise.all([
    collection.find(filter).sort({ endedAt: -1 }).skip(offset).limit(limit).toArray(),
    collection.countDocuments(filter),
  ]);

  return { calls, total };
}

export async function getAnalysisTrends(): Promise<
  Array<{
    callId: string;
    startedAt: Date;
    endedAt?: Date;
    rubricScore: number;
    sentimentTrend: string;
    flagCount: number;
    rubricPassed: number;
    rubricTotal: number;
  }>
> {
  const docs = await conversations()
    .find({ status: 'completed', analysisStatus: 'completed', analysis: { $exists: true } })
    .sort({ endedAt: 1 })
    .project({
      callId: 1,
      startedAt: 1,
      endedAt: 1,
      analysis: 1,
    })
    .toArray();

  return docs.map((doc) => ({
    callId: doc.callId,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt,
    rubricScore: doc.analysis!.rubric_score,
    sentimentTrend: doc.analysis!.sentiment_trend,
    flagCount: doc.analysis!.flags.length,
    rubricPassed: doc.analysis!.rubric.filter((r) => r.passed).length,
    rubricTotal: doc.analysis!.rubric.length,
  }));
}
