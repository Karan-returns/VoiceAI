import type { AnalysisStatus, CallAnalysisScorecard } from '../analysis/types.js';

export interface ConversationDocument {
  callId: string;
  roomName: string;
  jobId: string;
  startedAt: Date;
  endedAt?: Date;
  status: ConversationStatus;
  closeReason?: string;
  promptVersion: string;
  providers: {
    stt: string;
    llm: string;
    tts: string;
  };
  turns: ConversationTurn[];
  usage?: unknown;
  analysis?: CallAnalysisScorecard;
  analysisStatus?: AnalysisStatus;
  analysisError?: string;
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
