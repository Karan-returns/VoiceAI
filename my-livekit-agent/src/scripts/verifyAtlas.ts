import 'dotenv/config';

import { initializeLogger } from '@livekit/agents';

import { config } from '../config/index.js';
import { connectMongo, disconnectMongo, ensureIndexes } from '../db/client.js';
import { seedBillingAccounts } from '../db/billingRepository.js';
import { ensurePromptSeeded } from '../services/promptLoader.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

if (uri.includes('127.0.0.1') || uri.includes('localhost')) {
  console.error('MONGODB_URI still points to localhost. Use your Atlas mongodb+srv:// URI.');
  process.exit(1);
}

const seedBilling = process.argv.includes('--seed-billing');

initializeLogger({ pretty: true, level: config.logLevel });

try {
  console.log('Connecting to Atlas...');
  const db = await connectMongo(uri);
  const dbName = db.databaseName;

  console.log(`Connected to database: ${dbName}`);
  console.log('Creating indexes...');
  await ensureIndexes();

  console.log('Seeding default agent prompt (if missing)...');
  await ensurePromptSeeded();

  if (seedBilling) {
    const count = await seedBillingAccounts();
    console.log(`Billing seed: ${count} account(s) upserted`);
  } else {
    console.log('Skipping billing seed (pass --seed-billing to include)');
  }

  const collections = await db.listCollections().toArray();
  console.log(`Collections: ${collections.map((c) => c.name).join(', ') || '(none yet)'}`);

  console.log('\nAtlas setup verified successfully.');
  console.log('Next steps:');
  console.log('  npm run seed:billing          # if not done yet');
  console.log('  bash scripts/prepareSecrets.sh');
  console.log('  bash scripts/deploy.sh');
} catch (err) {
  console.error('Atlas verification failed:', err);
  process.exit(1);
} finally {
  await disconnectMongo();
}
