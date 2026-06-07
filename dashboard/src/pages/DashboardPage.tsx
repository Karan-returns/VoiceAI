import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCalls, fetchTrends } from '../api';
import TrendComparison from '../components/TrendComparison';
import type { CallSummary, TrendPoint } from '../types';
import { formatDate, formatDuration, scoreColor, trendLabel } from '../utils/format';

export default function DashboardPage() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCalls(true), fetchTrends()])
      .then(([callsRes, trendsRes]) => {
        setCalls(callsRes.calls);
        setTrends(trendsRes.trends);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-16 text-center text-text-muted">
        Loading call reports…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-16">
        <div className="bg-fail-soft/30 border border-fail/30 rounded-xl p-6 text-center">
          <p className="text-fail font-medium mb-2">Could not connect to API</p>
          <p className="text-sm text-text-secondary">{error}</p>
          <p className="text-xs text-text-muted mt-3">
            Run <code className="font-mono bg-surface-overlay px-1.5 py-0.5 rounded">npm run dev</code> from the
            dashboard folder. Seed demo data with{' '}
            <code className="font-mono bg-surface-overlay px-1.5 py-0.5 rounded">npm run seed:demo</code>.
          </p>
        </div>
      </div>
    );
  }

  const avgScore =
    calls.length > 0
      ? Math.round(calls.reduce((s, c) => s + (c.rubricScore ?? 0), 0) / calls.length)
      : 0;
  const totalFlags = calls.reduce((s, c) => s + (c.flagCount ?? 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">QA Reports</h1>
          <p className="text-sm text-text-secondary mt-1">
            {calls.length} analyzed call{calls.length !== 1 ? 's' : ''} · Monday morning ready
          </p>
        </div>
        <div className="flex gap-6">
          <Stat label="Avg QA Score" value={String(avgScore)} color={scoreColor(avgScore)} />
          <Stat label="Total Flags" value={String(totalFlags)} color={totalFlags > 5 ? 'var(--color-warn)' : 'var(--color-text-primary)'} />
          <Stat label="Calls Reviewed" value={String(calls.length)} />
        </div>
      </div>

      {trends.length >= 2 && <TrendComparison trends={trends} />}

      {calls.length === 0 ? (
        <div className="bg-surface-raised border border-border-subtle rounded-xl p-12 text-center">
          <p className="text-text-secondary mb-2">No analyzed calls yet</p>
          <p className="text-xs text-text-muted">
            Complete a call in the LiveKit playground, then run{' '}
            <code className="font-mono bg-surface-overlay px-1.5 py-0.5 rounded">npm run analyze:call -- &lt;callId&gt;</code>
            {' '}or seed demo data with{' '}
            <code className="font-mono bg-surface-overlay px-1.5 py-0.5 rounded">npm run seed:demo</code>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {calls.map((call) => (
            <CallCard key={call.callId} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] text-text-muted uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function CallCard({ call }: { call: CallSummary }) {
  const score = call.rubricScore ?? 0;
  const trend = call.sentimentTrend ? trendLabel(call.sentimentTrend) : null;

  return (
    <Link
      to={`/calls/${call.callId}`}
      className="block bg-surface-raised border border-border-subtle rounded-xl p-5 hover:border-accent/40 hover:bg-surface-overlay/30 transition-all no-underline group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-mono text-text-muted truncate max-w-[180px]">{call.callId}</div>
          <div className="text-sm text-text-secondary mt-0.5">{formatDate(call.startedAt)}</div>
        </div>
        <div
          className="text-2xl font-bold tabular-nums"
          style={{ color: scoreColor(score) }}
        >
          {score}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>{formatDuration(call.durationMs)}</span>
        <span>·</span>
        <span>{call.turnCount ?? 0} turns</span>
        {(call.flagCount ?? 0) > 0 && (
          <>
            <span>·</span>
            <span className="text-warn">{call.flagCount} flag{(call.flagCount ?? 0) !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {trend && (
        <div className="mt-3 flex items-center justify-between">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
            style={{ background: `${trend.color}20`, color: trend.color }}
          >
            {trend.label}
          </span>
          <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
            View report →
          </span>
        </div>
      )}
    </Link>
  );
}
