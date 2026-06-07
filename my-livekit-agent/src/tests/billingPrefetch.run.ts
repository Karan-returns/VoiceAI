import { resolveAccountLastFour } from '../services/billingPrefetch.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

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

  console.log('billingPrefetch.run: all assertions passed');
}

run();
