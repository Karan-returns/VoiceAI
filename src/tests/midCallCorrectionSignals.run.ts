import {
  agentAddressedObjection,
  detectDeEscalation,
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
  assert(detectDeEscalation('Thank you, that helps') === 'thank_you', 'de-escalation thanks');
  assert(detectDeEscalation('I understand your point') === 'understanding', 'de-escalation understanding');
  assert(detectDeEscalation('Okay got it') === 'affirmation', 'de-escalation affirmation');
  assert(detectEscalationLanguage('Thank you') === null, 'thank you is not escalation');
  assert(detectEscalationLanguage('I will file a lawsuit') === 'lawsuit', 'lawsuit escalation');

  console.log('midCallCorrection signals: all checks passed');
}

run();
