import { normalizeLastFour } from '../utils/normalizeLastFour.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): void {
  assert(normalizeLastFour('5678').ok === true, 'plain digits');
  assert(
    normalizeLastFour('five six seven eight').ok === true &&
      (normalizeLastFour('five six seven eight') as { ok: true }).lastFour === '5678',
    'spoken digits',
  );
  assert(normalizeLastFour('78910').ok === false, 'too many digits');
  assert(normalizeLastFour('78').ok === false, 'too few digits');
  assert(
    normalizeLastFour('Five, six, seven, eight.').ok === true &&
      (normalizeLastFour('Five, six, seven, eight.') as { ok: true }).lastFour === '5678',
    'spoken digits with punctuation',
  );
  assert(
    normalizeLastFour('Five six seven eight, and it\'s for me.').ok === true &&
      (normalizeLastFour('Five six seven eight, and it\'s for me.') as { ok: true }).lastFour ===
        '5678',
    'spoken digits with trailing words',
  );
  assert(
    normalizeLastFour('For the month, May, my digits are 5678.').ok === true &&
      (normalizeLastFour('For the month, May, my digits are 5678.') as { ok: true }).lastFour ===
        '5678',
    'embedded numeric digits',
  );

  console.log('normalizeLastFour: all checks passed');
}

run();
