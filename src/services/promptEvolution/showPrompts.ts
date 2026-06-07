import type { AgentPromptDocument } from '../../db/promptTypes.js';
import { getPromptByVersion } from '../../db/promptRepository.js';

export async function resolvePreviousContent(
  prompt: AgentPromptDocument,
): Promise<string | undefined> {
  if (prompt.previousContent) {
    return prompt.previousContent;
  }
  if (!prompt.parentVersion) {
    return undefined;
  }
  const parent = await getPromptByVersion(prompt.parentVersion);
  return parent?.content;
}

export function extractSection(content: string, sectionHeading: string): string | null {
  const headings = [...content.matchAll(/^# .+$/gm)].map((match) => match[0].trim());
  const normalized = sectionHeading.trim().toLowerCase();
  const resolved =
    headings.find((heading) => heading.toLowerCase() === normalized) ??
    headings.find(
      (heading) =>
        heading.toLowerCase().startsWith(normalized) ||
        normalized.startsWith(heading.toLowerCase()),
    );

  if (!resolved) {
    return null;
  }

  const pattern = new RegExp(
    `(^|\\n)(${resolved.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n)([\\s\\S]*?)(?=\\n# |$)`,
    'm',
  );
  const match = pattern.exec(content);
  if (!match) {
    return null;
  }
  return `${resolved}\n${match[3]?.trimEnd() ?? ''}`.trimEnd();
}

export function formatPromptComparison(
  before: AgentPromptDocument,
  after: AgentPromptDocument,
  previousContent: string,
): string {
  const lines = [
    `Prompt evolution: ${before.version} → ${after.version}`,
    `Triggered by call: ${after.triggeredByCallId}`,
    `Section patched: ${after.sectionPatched}`,
    `Summary: ${after.patchSummary}`,
    '',
    '═'.repeat(72),
    `BEFORE (${before.version})`,
    '═'.repeat(72),
    previousContent,
    '',
    '═'.repeat(72),
    `AFTER (${after.version})`,
    '═'.repeat(72),
    after.content,
  ];

  const beforeSection = extractSection(previousContent, after.sectionPatched);
  const afterSection = extractSection(after.content, after.sectionPatched);
  if (beforeSection && afterSection && beforeSection !== afterSection) {
    lines.push(
      '',
      '═'.repeat(72),
      'CHANGED SECTION ONLY',
      '═'.repeat(72),
      '--- before ---',
      beforeSection,
      '',
      '--- after ---',
      afterSection,
    );
  }

  return lines.join('\n');
}
