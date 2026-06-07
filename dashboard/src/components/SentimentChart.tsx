import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CallAnalysisScorecard } from '../types';
import { sentimentChartData } from '../utils/format';

interface SentimentChartProps {
  analysis: CallAnalysisScorecard;
  startIso: string;
}

const SENTIMENT_LABELS = ['', 'Angry', 'Frustrated', 'Neutral', 'Positive'];

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ReturnType<typeof sentimentChartData>[0] }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-surface-overlay border border-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <div className="font-mono text-text-muted mb-1">{d.time}</div>
      <div className="font-medium capitalize text-text-primary">{d.sentiment}</div>
      {d.trigger && <div className="text-text-secondary mt-1 max-w-[200px]">{d.trigger}</div>}
    </div>
  );
}

export default function SentimentChart({ analysis, startIso }: SentimentChartProps) {
  const data = sentimentChartData(analysis, startIso);
  const trendColor =
    analysis.sentiment_trend === 'improving'
      ? 'var(--color-pass)'
      : analysis.sentiment_trend === 'deteriorating'
        ? 'var(--color-fail)'
        : 'var(--color-text-secondary)';

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Sentiment Arc</h3>
          <p className="text-xs text-text-muted mt-0.5">Customer sentiment across the call timeline</p>
        </div>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
          style={{ background: `${trendColor}20`, color: trendColor }}
        >
          {analysis.sentiment_trend}
        </span>
      </div>
      <div className="p-4 pt-2 h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--color-border-subtle)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0.5, 4.5]}
              ticks={[1, 2, 3, 4]}
              tickFormatter={(v) => SENTIMENT_LABELS[v] ?? ''}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <ReferenceLine y={3} stroke="var(--color-border)" strokeDasharray="4 4" />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: '#60a5fa' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
