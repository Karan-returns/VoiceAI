import { processBillingLookup } from '../db/billingRepository.js';
import type { BillingAccountDocument } from '../db/billingTypes.js';
import { summarizeBillingLookup } from '../services/summarizeBillingLookup.js';
import { resolveAccountLastFour } from '../services/billingPrefetch.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const sampleAccount: BillingAccountDocument = {
  accountLastFour: '5678',
  customerName: 'Casey Nguyen',
  plan: 'NovaTel Basic 30',
  monthlyCharge: 49.99,
  billMonth: '2026-05',
  recentCharges: [{ description: 'Monthly plan fee', amount: 49.99, date: '2026-05-01' }],
  duplicateChargeFlag: false,
  lateFeeOnAccount: 0,
  contractEndDate: '2025-01-01',
  underContract: false,
  earlyTerminationFee: 0,
  status: 'active',
  payments: [],
};

function run(): void {
  const fromDigits = resolveAccountLastFour('5678');
  assert(fromDigits?.lastFour === '5678', 'uses digits from current utterance');
  assert(fromDigits?.source === 'user', 'marks digit utterance as user source');

  const followUp = resolveAccountLastFour('Why are there duplicate charges?', '5678');
  assert(followUp?.lastFour === '5678', 'reuses known account on follow-up question');
  assert(followUp?.source === 'known', 'marks follow-up as known source');

  const noAccount = resolveAccountLastFour('Tell me about my bills.');
  assert(noAccount === null, 'returns null when no digits and no known account');

  const newDigits = resolveAccountLastFour('Actually it is 1234', '5678');
  assert(newDigits?.lastFour === '1234', 'prefers fresh digits over stale known account');

  const summary = summarizeBillingLookup(JSON.stringify(processBillingLookup(sampleAccount)));
  assert(summary.includes('5678'), 'summary includes account digits');
  assert(summary.includes('no duplicate'), 'summary includes duplicate status');
  assert(!summary.includes('recentCharges'), 'summary omits raw JSON field names');

  const notFound = summarizeBillingLookup(
    JSON.stringify({
      found: false,
      accountLastFour: '9999',
      customerName: '',
      billMonth: '',
      plan: '',
      monthlyCharge: 0,
      recentCharges: [],
      duplicateChargeFlag: false,
      lateFeeOnAccount: 0,
      contractEndDate: null,
      underContract: false,
      earlyTerminationFee: 0,
      status: 'active',
      totalDue: 0,
    }),
  );
  assert(notFound.includes('No NovaTel account'), 'summary handles not found');

  console.log('billingPrefetch.run: all assertions passed');
}

run();
