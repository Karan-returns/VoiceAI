import 'dotenv/config';
import { connectMongo, disconnectMongo } from './src/db/client.js';
import { getActivePrompt } from './src/db/promptRepository.js';
import { listPromptSections } from './src/prompts/promptEvolution.v1.js';
import { config } from './src/config/index.js';

async function main() {
  await connectMongo(config.mongodbUri!);
  const active = await getActivePrompt();
  if (!active) throw new Error('no active');
  const sections = listPromptSections(active.content);
  console.log('Version:', active.version);
  console.log('Detected sections:', sections.map((s) => s.label));
  await disconnectMongo();
}

main();
