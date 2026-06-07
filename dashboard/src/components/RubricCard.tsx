import type { RubricItem } from '../types';

interface RubricCardProps {
  items: RubricItem[];
}

export default function RubricCard({ items }: RubricCardProps) {
  const passed = items.filter((i) => i.passed).length;

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">QA Scorecard</h3>
        <span className="text-xs font-mono text-text-muted">
          {passed}/{items.length} passed
        </span>
      </div>
      <div className="p-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border p-4 transition-colors ${
              item.passed
                ? 'border-pass/20 bg-pass-soft/20'
                : 'border-fail/20 bg-fail-soft/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    item.passed ? 'bg-pass/20 text-pass' : 'bg-fail/20 text-fail'
                  }`}
                >
                  {item.passed ? '✓' : '✗'}
                </span>
                <span className="text-sm font-medium text-text-primary">{item.label}</span>
              </div>
              <span className="text-xs font-mono text-text-muted tabular-nums">{item.score}/20</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed pl-7">{item.evidence}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
