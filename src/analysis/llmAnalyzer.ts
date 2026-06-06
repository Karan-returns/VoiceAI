import { llm } from '@livekit/agents';

import type { LlmConfig } from '../config/types.js';
import {
  CALL_ANALYSIS_SYSTEM_PROMPT_V1,
  CALL_ANALYSIS_USER_PROMPT_V1,
} from '../prompts/callAnalysis.v1.js';
import { createLlm } from '../providers/llm/index.js';
import { createLogger } from '../utils/logger.js';
import type { HeuristicSignals } from './types.js';
import { LlmAnalysisResponseSchema, type LlmAnalysisResponse } from './types.js';

const logger = createLogger('analysis.llm');

async function collectLlmText(stream: llm.LLMStream): Promise<string> {
  let text = '';
  for await (const chunk of stream) {
    if (chunk.delta?.content) {
      text += chunk.delta.content;
    }
  }
  return text.trim();
}

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return raw.trim();
}

export async function runLlmAnalysis(
  transcript: string,
  heuristics: HeuristicSignals,
  llmConfig: LlmConfig,
): Promise<LlmAnalysisResponse> {
  const llmInstance = createLlm(llmConfig);

  const heuristicsJson = JSON.stringify(heuristics, null, 2);
  const userPrompt = CALL_ANALYSIS_USER_PROMPT_V1.replace('{heuristics_json}', heuristicsJson).replace(
    '{transcript}',
    transcript,
  );

  const chatCtx = llm.ChatContext.empty();
  chatCtx.addMessage({ role: 'system', content: CALL_ANALYSIS_SYSTEM_PROMPT_V1 });
  chatCtx.addMessage({ role: 'user', content: userPrompt });

  const stream = llmInstance.chat({
    chatCtx,
    connOptions: { maxRetry: 2, retryIntervalMs: 500, timeoutMs: 60000 },
    extraKwargs: {
      temperature: 0.2,
      response_format: { type: 'json_object' },
    },
  });

  const raw = await collectLlmText(stream);
  const jsonText = extractJsonPayload(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    logger.error({ err, raw: raw.slice(0, 500) }, 'LLM returned invalid JSON');
    throw new Error('Call analysis LLM response was not valid JSON');
  }

  const result = LlmAnalysisResponseSchema.safeParse(parsed);
  if (!result.success) {
    logger.error({ issues: result.error.issues, raw: jsonText.slice(0, 500) }, 'LLM JSON failed schema');
    throw new Error(`Call analysis JSON schema mismatch: ${result.error.message}`);
  }

  return result.data;
}
