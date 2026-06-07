import type { CallDetail, TurnAnnotation } from '../types';
import { flagType, formatTime, STAGE_COLORS } from '../utils/format';

interface TranscriptPanelProps {
  call: CallDetail;
  annotations: TurnAnnotation[];
}

function FlagBadge({ flag }: { flag: string }) {
  const type = flagType(flag);
  const styles =
    type === 'dead_air'
      ? 'bg-warn-soft/40 text-warn border-warn/30'
      : type === 'escalation'
        ? 'bg-fail-soft/40 text-fail border-fail/30'
        : 'bg-surface-overlay text-text-secondary border-border';

  const label =
    type === 'dead_air' ? 'Dead air' : type === 'escalation' ? 'Escalation' : flag;

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles}`}>
      {type === 'dead_air' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
          <circle cx="5" cy="5" r="4" opacity="0.3" />
        </svg>
      )}
      {type === 'escalation' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
          <path d="M5 1L9 9H1L5 1Z" />
        </svg>
      )}
      {label}
    </span>
  );
}

function SentimentDot({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    positive: 'var(--color-sentiment-positive)',
    neutral: 'var(--color-sentiment-neutral)',
    frustrated: 'var(--color-sentiment-frustrated)',
    angry: 'var(--color-sentiment-angry)',
  };
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ background: colors[sentiment] ?? colors.neutral }}
      title={sentiment}
    />
  );
}

export default function TranscriptPanel({ call, annotations }: TranscriptPanelProps) {
  const hasFlags = annotations.some((a) => a.flags.length || a.corrections.length);

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-text-primary">Transcript Review</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Side-by-side transcript with AI annotations
          {hasFlags && ' · flagged moments highlighted'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border-subtle">
        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-3 px-1">
            Original Transcript
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {call.turns.map((turn, i) => {
              const ann = annotations[i];
              const isFlagged = ann.flags.length > 0 || ann.corrections.length > 0;
              const isCustomer = turn.role === 'customer';

              return (
                <div
                  key={i}
                  className={`rounded-lg p-3 border transition-colors ${
                    isFlagged
                      ? 'border-warn/40 bg-warn-soft/10'
                      : 'border-transparent bg-surface/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-[10px] text-text-muted">
                      {formatTime(turn.timestamp, call.startedAt)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        isCustomer ? 'text-accent' : 'text-text-secondary'
                      }`}
                    >
                      {turn.role}
                    </span>
                    {ann.stage && (
                      <span
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded ml-auto"
                        style={{
                          background: `${STAGE_COLORS[ann.stage] ?? '#64748b'}20`,
                          color: STAGE_COLORS[ann.stage] ?? '#64748b',
                        }}
                      >
                        {ann.stage}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed">{turn.content}</p>
                  {isFlagged && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ann.flags.map((f) => (
                        <FlagBadge key={f} flag={f} />
                      ))}
                      {ann.corrections.map((c, ci) => (
                        <FlagBadge key={ci} flag={c.signal} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-surface/30">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-3 px-1">
            AI Annotations
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {call.turns.map((turn, i) => {
              const ann = annotations[i];
              const hasAnnotation =
                ann.sentiment || ann.flags.length || ann.corrections.length || ann.stage;

              if (!hasAnnotation) {
                return (
                  <div key={i} className="py-2 px-3 opacity-30">
                    <span className="text-[10px] font-mono text-text-muted">
                      {formatTime(turn.timestamp, call.startedAt)} — no annotation
                    </span>
                  </div>
                );
              }

              return (
                <div key={i} className="rounded-lg p-3 border border-border-subtle bg-surface-raised/60">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[10px] text-text-muted">
                      Turn {i + 1} · {formatTime(turn.timestamp, call.startedAt)}
                    </span>
                  </div>

                  {ann.sentiment && (
                    <div className="flex items-start gap-2 mb-2">
                      <SentimentDot sentiment={ann.sentiment} />
                      <div>
                        <span className="text-xs font-medium capitalize text-text-primary">
                          {ann.sentiment}
                        </span>
                        {ann.sentimentTrigger && (
                          <p className="text-[11px] text-text-secondary mt-0.5">{ann.sentimentTrigger}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {ann.stage && (
                    <div className="text-[11px] text-text-secondary mb-2">
                      <span className="text-text-muted">Stage: </span>
                      <span className="font-medium" style={{ color: STAGE_COLORS[ann.stage] }}>
                        {ann.stage}
                      </span>
                    </div>
                  )}

                  {ann.corrections.map((c, ci) => (
                    <div key={ci} className="text-[11px] mb-1.5 pl-2 border-l-2 border-warn/50">
                      <span className="text-warn font-medium capitalize">{c.signal.replace(/_/g, ' ')}</span>
                      {c.evidence && <span className="text-text-secondary"> — {c.evidence}</span>}
                      <span className="text-text-muted font-mono ml-1">({c.latencyMs}ms)</span>
                    </div>
                  ))}

                  {ann.flags.map((f) => (
                    <div key={f} className="mb-1">
                      <FlagBadge flag={f} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
