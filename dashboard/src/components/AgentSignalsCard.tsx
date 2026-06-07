import type { CallAnalysisScorecard } from '../types';

interface AgentSignalsCardProps {
  signals: CallAnalysisScorecard['agent_signals'];
  improvementAreas: string[];
  flags: string[];
}

export default function AgentSignalsCard({ signals, improvementAreas, flags }: AgentSignalsCardProps) {
  const lengthLabel = {
    too_short: { text: 'Too short', color: 'var(--color-warn)' },
    balanced: { text: 'Balanced', color: 'var(--color-pass)' },
    too_long: { text: 'Too long', color: 'var(--color-warn)' },
  }[signals.response_length_assessment];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-surface-raised border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Agent Signals</h3>
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Filler words" value={signals.filler_words} />
          <Metric label="Avg response" value={`${signals.avg_response_words} words`} />
          <Metric label="Unresolved objections" value={signals.unresolved_objections} warn={signals.unresolved_objections > 0} />
          <Metric label="Response length" value={lengthLabel.text} color={lengthLabel.color} />
        </div>
      </div>

      <div className="bg-surface-raised border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Coaching Notes</h3>
        {improvementAreas.length > 0 ? (
          <ul className="space-y-2">
            {improvementAreas.map((area, i) => (
              <li key={i} className="flex gap-2 text-xs text-text-secondary leading-relaxed">
                <span className="text-accent shrink-0 mt-0.5">→</span>
                {area}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-muted">No improvement areas flagged.</p>
        )}

        {flags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              All Flags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <span
                  key={f}
                  className="text-[10px] font-mono px-2 py-1 rounded bg-surface-overlay text-text-secondary"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
  color,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">{label}</div>
      <div
        className="text-lg font-semibold tabular-nums"
        style={{ color: color ?? (warn ? 'var(--color-warn)' : 'var(--color-text-primary)') }}
      >
        {value}
      </div>
    </div>
  );
}
