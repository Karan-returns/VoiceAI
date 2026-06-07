import { z } from 'zod';

import type { AppConfig } from '../../config/types.js';
import type { ExtractedFailure, PromptPatchProposal } from '../../db/promptTypes.js';
import {
  PROMPT_EVOLUTION_SYSTEM_PROMPT_V1,
  applyPromptPatch,
  buildPromptEvolutionUserPrompt,
} from '../../prompts/promptEvolution.v1.js';
import { completeWithLlm, parseJsonFromLlm } from '../../utils/llmComplete.js';

const PromptPatchProposalSchema = z.object({
  section_heading: z.string().min(1),
  operation: z.enum(['add', 'rewrite']),
  new_section_content: z.string().min(1),
  rationale: z.string().min(1),
  failures_addressed: z.array(z.string()),
});

export interface GeneratedPromptPatch {
  proposal: PromptPatchProposal;
  patchedContent: string;
}

export async function generatePromptPatch(
  config: AppConfig,
  currentPrompt: string,
  failures: ExtractedFailure[],
): Promise<GeneratedPromptPatch> {
  const userPrompt = buildPromptEvolutionUserPrompt(
    currentPrompt,
    failures.map((failure) => ({
      id: failure.id,
      description: failure.description,
      occurrences: failure.occurrences,
      evidence: failure.evidence,
    })),
  );

  const raw = await completeWithLlm(config, PROMPT_EVOLUTION_SYSTEM_PROMPT_V1, userPrompt, {
    temperature: 0.3,
  });

  const proposal = PromptPatchProposalSchema.parse(parseJsonFromLlm<PromptPatchProposal>(raw));
  const patchedContent = applyPromptPatch(
    currentPrompt,
    proposal.section_heading,
    proposal.operation,
    proposal.new_section_content,
  );

  return { proposal, patchedContent };
}
