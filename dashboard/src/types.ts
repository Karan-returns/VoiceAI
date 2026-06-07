export type Sentiment = 'positive' | 'neutral' | 'frustrated' | 'angry';
export type SentimentTrend = 'improving' | 'stable' | 'deteriorating';
export type CallStage = 'Greeting' | 'Discovery' | 'Resolution' | 'Escalation' | 'Closing';

export interface RubricItem {
  id: string;
  label: string;
  passed: boolean;
  score: number;
  evidence: string;
}

export interface SentimentArcEntry {
  turn_index: number;
  role: 'customer' | 'agent';
  sentiment: Sentiment;
  timestamp: string;
  trigger?: string;
}

export interface CallFlowEntry {
  turn_index: number;
  stage: string;
  agent_text_preview: string;
}

export interface AgentSignals {
  filler_words: number;
  avg_response_words: number;
  unresolved_objections: number;
  response_length_assessment: 'too_short' | 'balanced' | 'too_long';
}

export interface CallAnalysisScorecard {
  call_id: string;
  rubric_score: number;
  rubric: RubricItem[];
  sentiment_arc: SentimentArcEntry[];
  sentiment_trend: SentimentTrend;
  call_flow: CallFlowEntry[];
  flags: string[];
  agent_signals: AgentSignals;
  improvement_areas: string[];
  analyzed_at: string;
  prompt_version: string;
  model: string;
}

export interface ConversationTurn {
  role: 'customer' | 'agent';
  content: string;
  timestamp: string;
  interrupted?: boolean;
}

export interface MidCallCorrection {
  signal: string;
  blockId: string;
  evidence?: string;
  injectedAt: string;
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
  error?: string;
}

export interface CallSummary {
  callId: string;
  roomName: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  status: string;
  analysisStatus?: string;
  rubricScore?: number;
  sentimentTrend?: SentimentTrend;
  flagCount?: number;
  turnCount?: number;
  recording?: ConversationRecording;
}

export interface CallDetail extends CallSummary {
  promptVersion: string;
  turns: ConversationTurn[];
  corrections?: MidCallCorrection[];
  analysis?: CallAnalysisScorecard;
  analysisError?: string;
  recording?: ConversationRecording;
}

export interface TrendPoint {
  callId: string;
  startedAt: string;
  endedAt?: string;
  rubricScore: number;
  sentimentTrend: string;
  flagCount: number;
  rubricPassed: number;
  rubricTotal: number;
}

export interface TurnAnnotation {
  turnIndex: number;
  stage?: string;
  sentiment?: Sentiment;
  sentimentTrigger?: string;
  flags: string[];
  corrections: MidCallCorrection[];
  rubricEvidence: string[];
}
