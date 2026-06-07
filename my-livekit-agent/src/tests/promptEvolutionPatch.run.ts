import { NOVATEL_SUPPORT_PROMPT_V1 } from '../prompts/novaTelSupport.v1.js';
import {
  applyPromptPatch,
  listPromptSections,
} from '../prompts/promptEvolution.v1.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const sections = listPromptSections(NOVATEL_SUPPORT_PROMPT_V1);
assert(sections.length > 0, 'expected patchable sections in NovaTel prompt');
assert(
  sections.some((section) => section.label === 'Flow:'),
  'expected Flow: section',
);

const patched = applyPromptPatch(
  NOVATEL_SUPPORT_PROMPT_V1,
  '# Conversation flow',
  'add',
  'Flow: acknowledge concern → get digits if needed → resolve with policy → confirm next steps.\n- Greet within the first response when the customer speaks first.',
);
assert(patched.includes('Greet within the first response'), 'expected added flow guidance');
assert(patched.includes('lookupBillingAccount'), 'critical tool instructions must remain');

const rewritten = applyPromptPatch(
  NOVATEL_SUPPORT_PROMPT_V1,
  'Policies:',
  'rewrite',
  'Policies: duplicate refund three to five days; late fee waived once per twelve months.',
);
assert(
  rewritten.includes('Policies: duplicate refund three to five days'),
  'expected rewritten policies section',
);
assert(!rewritten.includes('escalate after one failed attempt'), 'rewrite should replace old policy text');

console.log('promptEvolution patch: all checks passed');
