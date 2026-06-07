import { z } from 'zod';

export const RubricItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  score: z.number(),
  evidence: z.string(),
});

export const SentimentArcEntrySchema = z.object({
  turn_index: z.number(),
  role: z.enum(['customer', 'agent']),
  sentiment: z.enum(['positive', 'neutral', 'frustrated', 'angry']),
  timestamp: z.string(),
  trigger: z.string().optional(),
});

export const CallFlowEntrySchema = z.object({
  turn_index: z.number(),
  stage: z.string(),
  agent_text_preview: z.string(),
});

export const AgentSignalsSchema = z.object({
  filler_words: z.number(),
  avg_response_words: z.number(),
  unresolved_objections: z.number(),
  response_length_assessment: z.enum(['too_short', 'balanced', 'too_long']),
});

export const CallAnalysisScorecardSchema = z.object({
  call_id: z.string(),
  rubric_score: z.number(),
  rubric: z.array(RubricItemSchema),
  sentiment_arc: z.array(SentimentArcEntrySchema),
  sentiment_trend: z.enum(['improving', 'stable', 'deteriorating']),
  call_flow: z.array(CallFlowEntrySchema),
  flags: z.array(z.string()),
  agent_signals: AgentSignalsSchema,
  improvement_areas: z.array(z.string()),
  analyzed_at: z.string(),
  prompt_version: z.string(),
  model: z.string(),
});

export type RubricItem = z.infer<typeof RubricItemSchema>;
export type CallAnalysisScorecard = z.infer<typeof CallAnalysisScorecardSchema>;

export type AnalysisStatus = 'pending' | 'completed' | 'failed';

export interface HeuristicSignals {
  filler_words: number;
  avg_response_words: number;
  dead_air_flags: string[];
  escalation_flags: string[];
  greeting_within_5s: boolean;
  unresolved_objections_hint: number;
}
