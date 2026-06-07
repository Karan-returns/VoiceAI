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
  corrections?: MidCallCorrectionRecord[];
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
