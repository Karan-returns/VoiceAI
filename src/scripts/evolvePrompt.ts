import 'dotenv/config';

import { initializeLogger } from '@livekit/agents';

import { config } from '../config/index.js';
import { connectMongo, disconnectMongo, ensureIndexes } from '../db/client.js';
import {
  getActivePrompt,
  getPromptByVersion,
  listPromptVersions,
  rollbackPromptToVersion,
} from '../db/promptRepository.js';
import { evolvePromptAfterCall } from '../services/promptEvolution/index.js';
import {
  formatPromptComparison,
  resolvePreviousContent,
} from '../services/promptEvolution/showPrompts.js';

async function showVersion(versionLabel: string): Promise<void> {
  const prompt = await getPromptByVersion(versionLabel);
  if (!prompt) {
    throw new Error(`Prompt version not found: ${versionLabel}`);
  }

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`${prompt.version}${prompt.isActive ? ' (active)' : ''}`);
  console.log(`Triggered by: ${prompt.triggeredByCallId}`);
  console.log(`Summary: ${prompt.patchSummary}`);
  console.log(`${'═'.repeat(72)}\n`);
  console.log(prompt.content);
}

async function showComparison(fromVersion: string, toVersion: string): Promise<void> {
  const before = await getPromptByVersion(fromVersion);
  const after = await getPromptByVersion(toVersion);

  if (!before || !after) {
    throw new Error(`Could not load prompts for comparison (${fromVersion} → ${toVersion})`);
  }

  const previousContent = (await resolvePreviousContent(after)) ?? before.content;
  console.log(formatPromptComparison(before, after, previousContent));
}

async function main(): Promise<void> {
  initializeLogger({ pretty: true, level: config.logLevel });

  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI is required for prompt evolution');
  }

  await connectMongo(config.mongodbUri);
  await ensureIndexes();

  const [command, arg, secondArg] = process.argv.slice(2);

  if (command === 'list') {
    const versions = await listPromptVersions();
    for (const version of versions) {
      console.log(
        `${version.isActive ? '*' : ' '} ${version.version} ← triggered by ${version.triggeredByCallId} (${version.createdAt.toISOString()})`,
      );
      console.log(`    ${version.patchSummary}`);
      if (version.parentVersion) {
        console.log(`    parent: ${version.parentVersion} · section: ${version.sectionPatched}`);
      }
    }
    await disconnectMongo();
    return;
  }

  if (command === 'show' && arg && secondArg) {
    await showComparison(arg, secondArg);
    await disconnectMongo();
    return;
  }

  if (command === 'show' && arg) {
    await showVersion(arg);
    await disconnectMongo();
    return;
  }

  if (command === 'show') {
    const active = await getActivePrompt();
    if (!active?.parentVersion) {
      console.log('Only one prompt version exists. Use: npm run evolve:prompt -- show v1');
      await disconnectMongo();
      return;
    }
    await showComparison(active.parentVersion, active.version);
    await disconnectMongo();
    return;
  }

  if (command === 'rollback' && arg) {
    const rolled = await rollbackPromptToVersion(arg);
    if (!rolled) {
      throw new Error(`Prompt version not found: ${arg}`);
    }
    console.log(`Active prompt rolled back to ${arg}`);
    await disconnectMongo();
    return;
  }

  if (!command) {
    console.error('Usage: npm run evolve:prompt -- <callId>');
    console.error('       npm run evolve:prompt -- list');
    console.error('       npm run evolve:prompt -- show              # v1 vs active');
    console.error('       npm run evolve:prompt -- show v1           # full v1 text');
    console.error('       npm run evolve:prompt -- show v1 v2        # before/after diff');
    console.error('       npm run evolve:prompt -- rollback <version>');
    process.exit(1);
  }

  const status = await evolvePromptAfterCall(command);
  console.log(`Prompt evolution ${status} for call ${command}`);

  await disconnectMongo();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
