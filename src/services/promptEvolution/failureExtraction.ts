import type { MidCallCorrectionRecord } from '../../db/types.js';
import type { CallAnalysisScorecard } from '../../analysis/types.js';
import type { ExtractedFailure } from '../../db/promptTypes.js';

const CORRECTION_FAILURE_DESCRIPTIONS: Record<
  MidCallCorrectionRecord['signal'],
  string
> = {
  unanswered_objection:
    'Agent skipped acknowledging the issue before proposing a solution — customer repeated the same concern',
  escalation_language:
    'Agent did not lead with empathy when customer used escalation language',
  sentiment_drop: 'Agent failed to slow down and empathize when customer sentiment dropped sharply',
  dead_air: 'Agent left prolonged silence without checking in with the customer',
  de_escalation:
    'Agent stayed in escalation mode after customer showed understanding or thanks',
};

const RUBRIC_FAILURE_DESCRIPTIONS: Record<string, string> = {
  greet_within_5s: 'Agent did not greet and introduce within the first response',
  acknowledge_before_solution:
    'Agent proposed solutions before acknowledging the customer concern',
  policy_explained_clearly: 'Agent did not explain NovaTel policy in clear plain language',
  closed_with_resolution: 'Agent did not close with a clear resolution or next step',
  avoided_dead_air: 'Call had prolonged dead air after agent turns',
};

export function extractRecurringFailures(input: {
  corrections?: MidCallCorrectionRecord[];
  analysis?: CallAnalysisScorecard;
  minCorrectionRepeats?: number;
}): ExtractedFailure[] {
  const minRepeats = input.minCorrectionRepeats ?? 2;
  const failures: ExtractedFailure[] = [];

  const correctionCounts = new Map<MidCallCorrectionRecord['signal'], string[]>();
  for (const correction of input.corrections ?? []) {
    const evidence = correctionCounts.get(correction.signal) ?? [];
    evidence.push(correction.evidence ?? `turn ${correction.turnIndex}`);
    correctionCounts.set(correction.signal, evidence);
  }

  for (const [signal, evidence] of correctionCounts) {
    if (evidence.length < minRepeats) {
      continue;
    }
    failures.push({
      id: `correction_${signal}`,
      description: CORRECTION_FAILURE_DESCRIPTIONS[signal],
      source: 'mid_call_correction',
      occurrences: evidence.length,
      evidence,
    });
  }

  for (const item of input.analysis?.rubric ?? []) {
    if (item.passed) {
      continue;
    }
    failures.push({
      id: `rubric_${item.id}`,
      description: RUBRIC_FAILURE_DESCRIPTIONS[item.id] ?? item.label,
      source: 'rubric',
      occurrences: 1,
      evidence: [item.evidence],
    });
  }

  for (const [index, area] of (input.analysis?.improvement_areas ?? []).entries()) {
    failures.push({
      id: `improvement_${index}`,
      description: area,
      source: 'improvement_area',
      occurrences: 1,
      evidence: [],
    });
  }

  for (const flag of input.analysis?.flags ?? []) {
    failures.push({
      id: `flag_${flag}`,
      description: `Call flag: ${flag}`,
      source: 'analysis_flag',
      occurrences: 1,
      evidence: [flag],
    });
  }

  return dedupeFailures(failures);
}

function dedupeFailures(failures: ExtractedFailure[]): ExtractedFailure[] {
  const byKey = new Map<string, ExtractedFailure>();

  for (const failure of failures) {
    const key = failure.description.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, failure);
      continue;
    }
    existing.occurrences += failure.occurrences;
    existing.evidence = [...new Set([...existing.evidence, ...failure.evidence])];
  }

  return [...byKey.values()].sort((a, b) => b.occurrences - a.occurrences);
}

export function selectFailuresForPatch(
  failures: ExtractedFailure[],
  maxFailures = 5,
): ExtractedFailure[] {
  const midCall = failures.filter((failure) => failure.source === 'mid_call_correction');
  if (midCall.length > 0) {
    return midCall.slice(0, maxFailures);
  }
  return failures.slice(0, maxFailures);
}
