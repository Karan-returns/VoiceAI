import 'dotenv/config';

import { initializeLogger } from '@livekit/agents';

import { config } from '../config/index.js';
import { connectMongo, disconnectMongo } from '../db/client.js';
import { seedBillingAccounts } from '../db/billingRepository.js';
import { TEST_BILLING_ACCOUNTS } from '../db/billingSeed.js';

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is required. Set it in .env and retry.');
  process.exit(1);
}

initializeLogger({ pretty: true, level: config.logLevel });

await connectMongo(uri);
const count = await seedBillingAccounts();
await disconnectMongo();

console.log(`Seeded ${count} billing account(s).`);
console.log('Test last-four digits:', TEST_BILLING_ACCOUNTS.map((a) => a.accountLastFour).join(', '));
