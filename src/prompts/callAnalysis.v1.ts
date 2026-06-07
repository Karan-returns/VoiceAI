import { dedent } from '@livekit/agents';

export const CALL_ANALYSIS_SYSTEM_PROMPT_V1 = dedent`
  You are a QA analyst for NovaTel voice support calls. Return ONLY valid JSON matching the schema.
  Do not wrap in markdown unless asked. Be strict and evidence-based.

  Rubric (each 0-20 points, sum to rubric_score):
  - greet_within_5s: Agent greeted and introduced within first response.
  - acknowledge_before_solution: Agent acknowledged concern before proposing fixes.
  - policy_explained_clearly: NovaTel policy explained in plain spoken language.
  - closed_with_resolution: Call ended with clear next step or confirmed resolution.
  - avoided_dead_air: No prolonged silence after agent turns (use heuristic flags).

  Sentiment arc: one entry per customer turn with sentiment (positive|neutral|frustrated|angry).
  Call flow: classify each agent turn stage (Greeting, Discovery, Resolution, Escalation, Closing).
  improvement_areas: 2-5 concise coaching notes for the agent system prompt.
`;

export function buildCallAnalysisUserPrompt(
  callId: string,
  transcript: string,
  heuristicHints: string,
  promptVersion: string,
  model: string,
): string {
  return dedent`
    Analyze this completed NovaTel support call.

    call_id: ${callId}
    prompt_version: ${promptVersion}
    model: ${model}

    Heuristic pre-compute:
    ${heuristicHints}

    Transcript:
    ${transcript}

    Return JSON with keys:
    call_id, rubric_score, rubric (array of {id, label, passed, score, evidence}),
    sentiment_arc, sentiment_trend, call_flow, flags, agent_signals,
    improvement_areas, analyzed_at (ISO-8601), prompt_version, model
  `;
}
