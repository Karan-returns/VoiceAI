import { dedent } from '@livekit/agents';

export const PROMPT_EVOLUTION_SYSTEM_PROMPT_V1 = dedent`
  You are a prompt engineer for NovaTel's voice support agent. Your job is to produce ONE targeted
  patch to the base system prompt based on recurring call failures.

  Rules:
  - Modify exactly ONE section (identified by its markdown heading, e.g. "# Conversation flow").
  - Either ADD bullet points to that section or REWRITE that section entirely — not both.
  - Keep voice-call constraints: plain spoken English, no markdown in agent output rules.
  - Do not remove critical policies or tool instructions.
  - The patch must directly address the listed failures.
  - Return ONLY valid JSON (no prose outside JSON).
`;

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

  return dedent`
    Recurring failures from the latest call (Loop 1 mid-call corrections + post-call analysis):

    ${failureList}

    Current base system prompt:
    ---
    ${currentPrompt}
    ---

    Return JSON:
    {
      "section_heading": "# Exact heading to patch",
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
  const resolvedHeading = resolveSectionHeading(currentPrompt, sectionHeading.trim());
  const headingPattern = new RegExp(
    `(^|\\n)(${escapeRegExp(resolvedHeading)}\\s*\\n)([\\s\\S]*?)(?=\\n# |$)`,
    'm',
  );
  const match = headingPattern.exec(currentPrompt);

  if (!match) {
    throw new Error(`Section not found in prompt: ${resolvedHeading}`);
  }

  const sectionBody = match[3] ?? '';
  const sectionStart = match.index + (match[1]?.length ?? 0);

  let replacement: string;
  if (operation === 'rewrite') {
    replacement = newSectionContent.trimEnd();
  } else {
    const addition = newSectionContent.replace(resolvedHeading, '').replace(sectionHeading, '').trim();
    replacement = `${resolvedHeading}\n${sectionBody.trimEnd()}\n${addition}`.trimEnd();
  }

  const before = currentPrompt.slice(0, sectionStart);
  const afterStart = sectionStart + (match[0].length - (match[1]?.length ?? 0));
  const after = currentPrompt.slice(afterStart);

  return `${before}${replacement}${after}`.trimEnd() + '\n';
}

function resolveSectionHeading(currentPrompt: string, requestedHeading: string): string {
  const headings = [...currentPrompt.matchAll(/^# .+$/gm)].map((match) => match[0].trim());
  const exact = headings.find((heading) => heading === requestedHeading);
  if (exact) {
    return exact;
  }

  const normalizedRequest = requestedHeading.toLowerCase();
  const prefixMatch = headings.find(
    (heading) =>
      heading.toLowerCase().startsWith(normalizedRequest) ||
      normalizedRequest.startsWith(heading.toLowerCase()),
  );
  if (prefixMatch) {
    return prefixMatch;
  }

  return requestedHeading;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
