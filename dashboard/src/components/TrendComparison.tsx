import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '../types';
import { formatDate } from '../utils/format';

interface TrendComparisonProps {
  trends: TrendPoint[];
}

export default function TrendComparison({ trends }: TrendComparisonProps) {
  if (trends.length < 2) return null;

  const chartData = trends.map((t, i) => ({
    name: `#${i + 1}`,
    callId: t.callId.slice(-8),
    date: formatDate(t.startedAt),
    score: t.rubricScore,
    flags: t.flagCount,
    passed: t.rubricPassed,
    total: t.rubricTotal,
  }));

  const avgScore = Math.round(trends.reduce((s, t) => s + t.rubricScore, 0) / trends.length);
  const scoreDelta = trends[trends.length - 1].rubricScore - trends[0].rubricScore;
  const flagDelta = trends[trends.length - 1].flagCount - trends[0].flagCount;

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Cross-Call Trends</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Comparing {trends.length} analyzed calls over time
          </p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-[10px] text-text-muted uppercase">Avg score</div>
            <div className="text-lg font-bold tabular-nums text-text-primary">{avgScore}</div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase">Score Δ</div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: scoreDelta >= 0 ? 'var(--color-pass)' : 'var(--color-fail)' }}
            >
              {scoreDelta >= 0 ? '+' : ''}
              {scoreDelta}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-text-muted uppercase">Flags Δ</div>
            <div
              className="text-lg font-bold tabular-nums"
              style={{ color: flagDelta <= 0 ? 'var(--color-pass)' : 'var(--color-fail)' }}
            >
              {flagDelta >= 0 ? '+' : ''}
              {flagDelta}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-[200px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
            QA Score Trend
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--color-border-subtle)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-overlay)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload;
                  return p ? `${p.date} · ${p.callId}` : '';
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                name="QA Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-[200px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 px-1">
            Flags & Rubric Pass Rate
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--color-border-subtle)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface-overlay)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="flags" fill="#ef4444" name="Flags" radius={[3, 3, 0, 0]} barSize={20} />
              <Bar dataKey="passed" fill="#22c55e" name="Rubric passed" radius={[3, 3, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
