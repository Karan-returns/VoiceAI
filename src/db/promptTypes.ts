export const AGENT_PROMPTS_COLLECTION = 'agent_prompts';

export type PromptPatchOperation = 'add' | 'rewrite';

export interface AgentPromptDocument {
  version: string;
  content: string;
  /** Full prompt text before this version was applied (audit trail). */
  previousContent?: string;
  parentVersion?: string;
  triggeredByCallId: string;
  patchSummary: string;
  sectionPatched: string;
  failuresAddressed: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface PromptPatchProposal {
  section_heading: string;
  operation: PromptPatchOperation;
  new_section_content: string;
  rationale: string;
  failures_addressed: string[];
}

export interface ExtractedFailure {
  id: string;
  description: string;
  source: 'mid_call_correction' | 'rubric' | 'improvement_area' | 'analysis_flag';
  occurrences: number;
  evidence: string[];
}

export type PromptEvolutionStatus = 'pending' | 'completed' | 'skipped' | 'failed';
