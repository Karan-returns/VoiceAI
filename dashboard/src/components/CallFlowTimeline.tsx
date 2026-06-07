import type { CallAnalysisScorecard, ConversationTurn } from '../types';
import { STAGE_COLORS, formatTime } from '../utils/format';

interface CallFlowTimelineProps {
  analysis: CallAnalysisScorecard;
  turns: ConversationTurn[];
  startIso: string;
}

export default function CallFlowTimeline({ analysis, turns, startIso }: CallFlowTimelineProps) {
  const stageAtTurn = new Map<number, string>();
  for (const entry of analysis.call_flow) {
    stageAtTurn.set(entry.turn_index, entry.stage);
  }

  const segments: Array<{ stage: string; fromTurn: number; toTurn: number }> = [];
  let currentStage: string | null = null;
  let fromTurn = 0;

  for (let i = 0; i < turns.length; i++) {
    const stage = stageAtTurn.get(i);
    if (stage && stage !== currentStage) {
      if (currentStage !== null) {
        segments.push({ stage: currentStage, fromTurn, toTurn: i - 1 });
      }
      currentStage = stage;
      fromTurn = i;
    }
  }
  if (currentStage !== null) {
    segments.push({ stage: currentStage, fromTurn, toTurn: turns.length - 1 });
  }

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-text-primary">Call Flow</h3>
        <p className="text-xs text-text-muted mt-0.5">Stage progression across agent turns</p>
      </div>

      <div className="p-5">
        <div className="flex rounded-lg overflow-hidden h-3 mb-4">
          {segments.map((seg, i) => {
            const width = ((seg.toTurn - seg.fromTurn + 1) / turns.length) * 100;
            const color = STAGE_COLORS[seg.stage] ?? '#64748b';
            return (
              <div
                key={`${seg.stage}-${i}`}
                style={{ width: `${width}%`, background: color }}
                title={`${seg.stage}: turns ${seg.fromTurn + 1}–${seg.toTurn + 1}`}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 mb-5">
          {Object.entries(STAGE_COLORS).map(([stage, color]) => (
            <div key={stage} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
              {stage}
            </div>
          ))}
        </div>

        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {analysis.call_flow.map((entry) => (
            <div
              key={entry.turn_index}
              className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-surface-overlay/50 transition-colors"
            >
              <span className="font-mono text-[11px] text-text-muted w-10 shrink-0 pt-0.5">
                {formatTime(turns[entry.turn_index]?.timestamp ?? startIso, startIso)}
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded shrink-0"
                style={{
                  background: `${STAGE_COLORS[entry.stage] ?? '#64748b'}25`,
                  color: STAGE_COLORS[entry.stage] ?? '#64748b',
                }}
              >
                {entry.stage}
              </span>
              <span className="text-xs text-text-secondary truncate">{entry.agent_text_preview}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
