import type { Collection } from 'mongodb';

import { getDb } from './client.js';
import {
  AGENT_PROMPTS_COLLECTION,
  type AgentPromptDocument,
} from './promptTypes.js';

function prompts(): Collection<AgentPromptDocument> {
  return getDb().collection<AgentPromptDocument>(AGENT_PROMPTS_COLLECTION);
}

export async function getActivePrompt(): Promise<AgentPromptDocument | null> {
  return prompts().findOne({ isActive: true }, { sort: { createdAt: -1 } });
}

export async function getPromptByVersion(version: string): Promise<AgentPromptDocument | null> {
  return prompts().findOne({ version });
}

export async function listPromptVersions(): Promise<AgentPromptDocument[]> {
  return prompts().find({}).sort({ createdAt: -1 }).toArray();
}

export async function seedPromptIfEmpty(
  version: string,
  content: string,
  triggeredByCallId: string,
): Promise<AgentPromptDocument> {
  const existing = await getActivePrompt();
  if (existing) {
    return existing;
  }

  const now = new Date();
  const doc: AgentPromptDocument = {
    version,
    content,
    triggeredByCallId,
    patchSummary: 'Initial base prompt',
    sectionPatched: '(none — seed)',
    failuresAddressed: [],
    isActive: true,
    createdAt: now,
  };

  await prompts().insertOne(doc);
  return doc;
}

/** Update the untouched v1 seed when the static prompt file changes (dev convenience). */
export async function syncSeedPromptContent(
  version: string,
  content: string,
): Promise<void> {
  const doc = await getPromptByVersion(version);
  if (
    !doc ||
    doc.patchSummary !== 'Initial base prompt' ||
    doc.content === content
  ) {
    return;
  }

  await prompts().updateOne({ version }, { $set: { content } });
}

export async function savePromptVersion(doc: AgentPromptDocument): Promise<void> {
  await prompts().updateMany({ isActive: true }, { $set: { isActive: false } });
  await prompts().insertOne({ ...doc, isActive: true });
}

export async function rollbackPromptToVersion(version: string): Promise<AgentPromptDocument | null> {
  const target = await getPromptByVersion(version);
  if (!target) {
    return null;
  }

  await prompts().updateMany({ isActive: true }, { $set: { isActive: false } });
  await prompts().updateOne({ version }, { $set: { isActive: true } });
  return { ...target, isActive: true };
}

export function nextPromptVersion(currentVersion: string): string {
  const match = /^v(\d+)$/.exec(currentVersion);
  if (!match?.[1]) {
    return `${currentVersion}-evolved`;
  }
  return `v${Number(match[1]) + 1}`;
}
