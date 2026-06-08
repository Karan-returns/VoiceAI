import { dedent } from '@livekit/agents';

export const PROMPT_EVOLUTION_SYSTEM_PROMPT_V1 = dedent`
  You are a prompt engineer for NovaTel's voice support agent. Your job is to produce ONE targeted
  patch to the base system prompt based on recurring call failures.

  Rules:
  - Modify exactly ONE section from the patchable section list in the user message.
  - Use that exact section_heading string (e.g. "Flow:", "Policies:") — do not invent headings.
  - Either ADD bullet points to that section or REWRITE that section entirely — not both.
  - Keep voice-call constraints: plain spoken English, no markdown in agent output rules.
  - Do not remove critical policies or tool instructions.
  - The patch must directly address the listed failures.
  - Return ONLY valid JSON (no prose outside JSON).
`;

export interface PromptSection {
  /** Full first line of the section (may include inline content after the label). */
  headingLine: string;
  /** Short label used for matching, e.g. "Flow:" or "# Conversation flow". */
  label: string;
  start: number;
  end: number;
}

/** Lines that start a patchable section: markdown headings or "Label:" prefixes. */
const SECTION_START_PATTERN = /^(?:# [^\n]+|[A-Z][A-Za-z0-9 /'-]+:)/gm;

export function listPromptSections(prompt: string): PromptSection[] {
  const matches = [...prompt.matchAll(SECTION_START_PATTERN)];
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const headingLine = match[0].trim();
    const start = match.index ?? 0;
    const next = matches[index + 1];
    const end = next?.index ?? prompt.length;
    const label = headingLine.startsWith('# ')
      ? headingLine
      : `${headingLine.split(':')[0]?.trim() ?? headingLine}:`;

    return { headingLine, label, start, end };
  });
}

export function buildPromptEvolutionUserPrompt(
  currentPrompt: string,
  failures: Array<{ id: string; description: string; occurrences: number; evidence: string[] }>,
): string {
  const failureList = failures
    .map(
      (failure) =>
        `- [${failure.id}] (${failure.occurrences}x) ${failure.description}\n  Evidence: ${failure.evidence.join('; ') || 'n/a'}`,
    )
    .join('\n');

  const patchableSections = listPromptSections(currentPrompt)
    .map((section) => `- ${section.label}`)
    .join('\n');

  return dedent`
    Recurring failures from the latest call (Loop 1 mid-call corrections + post-call analysis):

    ${failureList}

    Patchable sections (pick exactly one section_heading from this list):
    ${patchableSections || '(none detected — use a "Label:" line from the prompt)'}

    Current base system prompt:
    ---
    ${currentPrompt}
    ---

    Return JSON:
    {
      "section_heading": "Exact label from patchable sections list",
      "operation": "add" | "rewrite",
      "new_section_content": "full new content for that section ONLY (include the heading line)",
      "rationale": "one sentence explaining the change",
      "failures_addressed": ["failure id or description", ...]
    }
  `;
}

export function applyPromptPatch(
  currentPrompt: string,
  sectionHeading: string,
  operation: 'add' | 'rewrite',
  newSectionContent: string,
): string {
  const sections = listPromptSections(currentPrompt);
  const section = findSection(sections, sectionHeading.trim());

  if (!section) {
    const available = sections.map((entry) => entry.label).join(', ') || 'none';
    throw new Error(`Section not found in prompt: ${sectionHeading} (available: ${available})`);
  }

  const existingContent = currentPrompt.slice(section.start, section.end);

  let replacement: string;
  if (operation === 'rewrite') {
    replacement = newSectionContent.trimEnd();
  } else {
    const addition = stripSectionHeading(newSectionContent, section.label).trim();
    replacement = addition ? `${existingContent.trimEnd()}\n${addition}`.trimEnd() : existingContent.trimEnd();
  }

  const before = currentPrompt.slice(0, section.start);
  const after = currentPrompt.slice(section.end);
  // `section.end` is the first character of the next heading, so the blank line that separated
  // this section from the next one lives at the tail of `replacement` and was stripped by the
  // trimEnd above. Re-insert a blank-line separator; otherwise the following heading is glued
  // onto this section's last line, drops out of `listPromptSections` (which only matches headings
  // at line start), and the prompt progressively loses sections on each patch.
  const separator = after.trim().length > 0 ? '\n\n' : '';

  return `${before}${replacement}${separator}${after}`.trimEnd() + '\n';
}

function findSection(sections: PromptSection[], requestedHeading: string): PromptSection | undefined {
  const requestKey = normalizeSectionKey(requestedHeading);

  const exact = sections.find(
    (section) =>
      section.label === requestedHeading ||
      section.headingLine === requestedHeading ||
      normalizeSectionKey(section.label) === requestKey,
  );
  if (exact) {
    return exact;
  }

  const fuzzy = sections.find((section) => {
    const labelKey = normalizeSectionKey(section.label);
    return (
      requestKey.includes(labelKey) ||
      labelKey.includes(requestKey) ||
      sectionWordsOverlap(requestKey, labelKey)
    );
  });

  return fuzzy;
}

function normalizeSectionKey(heading: string): string {
  return heading
    .replace(/^#\s*/, '')
    .replace(/:\s*.*$/, '')
    .replace(/:\s*$/, '')
    .trim()
    .toLowerCase();
}

function sectionWordsOverlap(requestKey: string, labelKey: string): boolean {
  const words = requestKey.split(/\s+/).filter((word) => word.length > 2);
  return words.some((word) => labelKey.includes(word));
}

function stripSectionHeading(content: string, label: string): string {
  const trimmed = content.trim();
  const labelKey = normalizeSectionKey(label);
  const lines = trimmed.split('\n');
  const firstLine = lines[0]?.trim() ?? '';

  if (
    firstLine === label ||
    firstLine.startsWith(`${label} `) ||
    normalizeSectionKey(firstLine) === labelKey
  ) {
    return lines.slice(1).join('\n');
  }

  return trimmed.replace(label, '').trim();
}
