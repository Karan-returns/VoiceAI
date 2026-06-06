import { z } from 'zod';

export const CALL_FLOW_STAGES = [
  'Greeting',
  'Discovery',
  'Resolution Attempt',
  'Objection Handling',
  'Escalation',
  'Close',
] as const;

export const CUSTOMER_SENTIMENTS = ['positive', 'neutral', 'frustrated', 'angry'] as const;

export const SENTIMENT_TRENDS = ['improving', 'stable', 'deteriorating'] as const;

export const RESPONSE_LENGTH_ASSESSMENTS = ['terse', 'balanced', 'rambling'] as const;

export type CallFlowStage = (typeof CALL_FLOW_STAGES)[number];
export type CustomerSentiment = (typeof CUSTOMER_SENTIMENTS)[number];
export type SentimentTrend = (typeof SENTIMENT_TRENDS)[number];
export type ResponseLengthAssessment = (typeof RESPONSE_LENGTH_ASSESSMENTS)[number];

export const RubricCriterionSchema = z.object({
  id: z.enum([
    'greet_within_5s',
    'acknowledge_before_solution',
    'policy_explained_clearly',
    'closed_with_resolution',
    'avoided_dead_air',
  ]),
  label: z.string(),
  passed: z.boolean(),
  score: z.number().min(0).max(20),
  evidence: z.string(),
});

export const SentimentArcEntrySchema = z.object({
  turn_index: z.number().int().nonnegative(),
  role: z.literal('customer'),
  sentiment: z.enum(CUSTOMER_SENTIMENTS),
  timestamp: z.string(),
  trigger: z.string().optional(),
});

export const CallFlowEntrySchema = z.object({
  turn_index: z.number().int().nonnegative(),
  stage: z.enum(CALL_FLOW_STAGES),
  agent_text_preview: z.string(),
});

export const AgentSignalsSchema = z.object({
  filler_words: z.number().int().nonnegative(),
  avg_response_words: z.number().nonnegative(),
  unresolved_objections: z.number().int().nonnegative(),
  response_length_assessment: z.enum(RESPONSE_LENGTH_ASSESSMENTS),
});

export const LlmAnalysisResponseSchema = z.object({
  rubric: z.array(RubricCriterionSchema).length(5),
  sentiment_arc: z.array(SentimentArcEntrySchema).min(1),
  sentiment_trend: z.enum(SENTIMENT_TRENDS),
  call_flow: z.array(CallFlowEntrySchema).min(1),
  unresolved_objections: z.array(
    z.object({
      customer_turn_index: z.number().int().nonnegative(),
      issue: z.string(),
      addressed: z.boolean(),
    }),
  ),
  improvement_areas: z.array(z.string()).min(1).max(5),
});

export const CallAnalysisScorecardSchema = z.object({
  call_id: z.string(),
  rubric_score: z.number().min(0).max(100),
  rubric: z.array(RubricCriterionSchema),
  sentiment_arc: z.array(SentimentArcEntrySchema),
  sentiment_trend: z.enum(SENTIMENT_TRENDS),
  call_flow: z.array(CallFlowEntrySchema),
  flags: z.array(z.string()),
  agent_signals: AgentSignalsSchema,
  improvement_areas: z.array(z.string()),
  analyzed_at: z.string(),
  prompt_version: z.string(),
  model: z.string(),
});

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;
export type SentimentArcEntry = z.infer<typeof SentimentArcEntrySchema>;
export type CallFlowEntry = z.infer<typeof CallFlowEntrySchema>;
export type AgentSignals = z.infer<typeof AgentSignalsSchema>;
export type LlmAnalysisResponse = z.infer<typeof LlmAnalysisResponseSchema>;
export type CallAnalysisScorecard = z.infer<typeof CallAnalysisScorecardSchema>;

export type AnalysisStatus = 'pending' | 'completed' | 'failed';

export interface HeuristicSignals {
  filler_words: number;
  avg_response_words: number;
  dead_air_flags: string[];
  escalation_flags: string[];
  greeting_within_5s: boolean | null;
  greeting_evidence: string;
}
