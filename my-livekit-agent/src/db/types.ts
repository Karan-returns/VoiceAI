import type { CallAnalysisScorecard } from '../analysis/types.js';
import type { AnalysisStatus } from '../analysis/types.js';
import type { PromptEvolutionStatus } from './promptTypes.js';

export type MidCallCorrectionSignal =
  | 'de_escalation'
  | 'escalation_language'
  | 'sentiment_drop'
  | 'unanswered_objection'
  | 'dead_air';

export interface MidCallCorrectionRecord {
  signal: MidCallCorrectionSignal;
  blockId: MidCallCorrectionSignal;
  evidence?: string;
  injectedAt: Date;
  latencyMs: number;
  turnIndex: number;
}

export type RecordingStatus = 'pending' | 'stored' | 'failed';

export interface ConversationRecording {
  status: RecordingStatus;
  format: 'mp3';
  filename?: string;
  gridFsId?: string;
  sizeBytes?: number;
  durationMs?: number;
  error?: string;
}

export interface ConversationDocument {
  callId: string;
  roomName: string;
  jobId: string;
  startedAt: Date;
  endedAt?: Date;
  status: ConversationStatus;
  closeReason?: string;
  recording?: ConversationRecording;
  promptVersion: string;
  providers: {
    stt: string;
    llm: string;
    tts: string;
  };
  turns: ConversationTurn[];
  corrections?: MidCallCorrectionRecord[];
  analysis?: CallAnalysisScorecard;
  analysisStatus?: AnalysisStatus;
  analysisError?: string;
  promptEvolutionStatus?: PromptEvolutionStatus;
  promptEvolution?: {
    fromVersion?: string;
    toVersion?: string;
    sectionPatched?: string;
    patchSummary?: string;
    failuresAddressed?: string[];
    error?: string;
  };
  usage?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type SpeakerRole = 'customer' | 'agent';

export type ConversationStatus = 'active' | 'completed' | 'failed';

export interface ConversationTurn {
  role: SpeakerRole;
  content: string;
  timestamp: Date;
  interrupted?: boolean;
}

export const CONVERSATIONS_COLLECTION = 'conversations';

export const RECORDINGS_BUCKET = 'recordings';
