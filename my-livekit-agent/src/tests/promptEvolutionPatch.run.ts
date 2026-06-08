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

// Regression: a patch must NOT glue the following heading onto the patched section's last line.
// Otherwise the next heading drops below the line-start anchor and silently disappears, which
// previously cascaded the prompt into losing whole sections on every evolution.
const sectionsBefore = listPromptSections(NOVATEL_SUPPORT_PROMPT_V1).map((s) => s.label);
for (const operation of ['add', 'rewrite'] as const) {
  const patched = applyPromptPatch(
    NOVATEL_SUPPORT_PROMPT_V1,
    'Voice rules:',
    operation,
    'Voice rules: speak clearly and keep it short.',
  );
  const sectionsAfter = listPromptSections(patched).map((s) => s.label);
  for (const label of sectionsBefore) {
    assert(
      sectionsAfter.includes(label),
      `${operation} patch dropped section "${label}" (heading merged into previous line)`,
    );
  }
  assert(
    !/\S(?:Account data|Flow|Policies|Tools|If frustrated):/.test(patched),
    `${operation} patch glued a heading onto the previous line`,
  );
}

console.log('promptEvolution patch: all checks passed');
