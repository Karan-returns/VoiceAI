import { extractRecurringFailures, selectFailuresForPatch } from '../services/promptEvolution/failureExtraction.js';
import type { MidCallCorrectionRecord } from '../db/types.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const corrections: MidCallCorrectionRecord[] = [
  {
    signal: 'unanswered_objection',
    blockId: 'unanswered_objection',
    evidence: 'bill wrong',
    injectedAt: new Date(),
    latencyMs: 10,
    turnIndex: 2,
  },
  {
    signal: 'unanswered_objection',
    blockId: 'unanswered_objection',
    evidence: 'charged twice',
    injectedAt: new Date(),
    latencyMs: 12,
    turnIndex: 4,
  },
];

const failures = extractRecurringFailures({ corrections, minCorrectionRepeats: 2 });
assert(failures.length === 1, 'expected one recurring failure');
assert(failures[0]?.id === 'correction_unanswered_objection', 'expected objection failure');
assert(failures[0]?.occurrences === 2, 'expected two occurrences');

const selected = selectFailuresForPatch(failures);
assert(selected.length === 1, 'expected one selected failure');

const noRepeat = extractRecurringFailures({
  corrections: [corrections[0]!],
  minCorrectionRepeats: 2,
});
assert(noRepeat.length === 0, 'single correction should not count as recurring');

console.log('promptEvolution failureExtraction: all checks passed');
