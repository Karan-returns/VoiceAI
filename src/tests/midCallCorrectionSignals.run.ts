import {
  agentAddressedObjection,
  detectEscalationLanguage,
  detectObjectionTopic,
  scoreSentiment,
  sentimentDropLevels,
} from '../services/midCallCorrection/signals.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): void {
  assert(detectEscalationLanguage('This is ridiculous, get me a manager') === 'ridiculous', 'escalation');
  assert(scoreSentiment('I am furious, this is the worst') === 'angry', 'angry sentiment');
  assert(scoreSentiment('Thanks, that helps a lot') === 'positive', 'positive sentiment');
  assert(sentimentDropLevels('neutral', 'angry') === 2, 'sentiment drop');
  assert(detectObjectionTopic('My bill was charged twice') === 'bill_wrong', 'bill objection');
  assert(
    !agentAddressedObjection('Which billing month are you asking about?', 'bill_wrong'),
    'unanswered objection',
  );
  assert(
    agentAddressedObjection('I understand how frustrating duplicate charges are.', 'bill_wrong'),
    'answered objection',
  );

  console.log('midCallCorrection signals: all checks passed');
}

run();
