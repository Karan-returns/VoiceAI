import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchCall } from '../api';
import AgentSignalsCard from '../components/AgentSignalsCard';
import CallFlowTimeline from '../components/CallFlowTimeline';
import RubricCard from '../components/RubricCard';
import ScoreRing from '../components/ScoreRing';
import SentimentChart from '../components/SentimentChart';
import RecordingPanel from '../components/RecordingPanel';
import TranscriptPanel from '../components/TranscriptPanel';
import type { CallDetail } from '../types';
import { buildTurnAnnotations, formatDate, formatDuration, trendLabel } from '../utils/format';

export default function CallDetailPage() {
  const { callId } = useParams<{ callId: string }>();
  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) return;
    fetchCall(callId)
      .then(setCall)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [callId]);

  const annotations = useMemo(() => (call ? buildTurnAnnotations(call) : []), [call]);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-16 text-center text-text-muted">
        Loading call report…
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-16 text-center">
        <p className="text-fail mb-4">{error ?? 'Call not found'}</p>
        <Link to="/" className="text-accent text-sm hover:underline">
          ← Back to reports
        </Link>
      </div>
    );
  }

  const analysis = call.analysis;
  const trend = analysis ? trendLabel(analysis.sentiment_trend) : null;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/" className="text-xs text-text-muted hover:text-accent transition-colors no-underline">
            ← All reports
          </Link>
          <h1 className="text-xl font-bold text-text-primary mt-2 font-mono">{call.callId}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
            <span>{formatDate(call.startedAt)}</span>
            <span className="text-text-muted">·</span>
            <span>{formatDuration(call.durationMs)}</span>
            <span className="text-text-muted">·</span>
            <span>{call.turns.length} turns</span>
            {analysis && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-text-muted">Prompt {analysis.prompt_version}</span>
              </>
            )}
          </div>
        </div>

        {analysis && (
          <div className="flex items-center gap-6">
            {trend && (
              <span
                className="text-xs font-medium px-3 py-1.5 rounded-full capitalize"
                style={{ background: `${trend.color}20`, color: trend.color }}
              >
                Sentiment {trend.label.toLowerCase()}
              </span>
            )}
            <ScoreRing score={analysis.rubric_score} />
          </div>
        )}
      </div>

      <RecordingPanel callId={call.callId} recording={call.recording} />

      {!analysis ? (
        <div className="bg-surface-raised border border-border-subtle rounded-xl p-8 text-center">
          <p className="text-text-secondary">
            {call.analysisStatus === 'pending'
              ? 'Analysis in progress…'
              : call.analysisError ?? 'No analysis available for this call.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SentimentChart analysis={analysis} startIso={call.startedAt} />
            <CallFlowTimeline analysis={analysis} turns={call.turns} startIso={call.startedAt} />
          </div>

          <RubricCard items={analysis.rubric} />

          <TranscriptPanel call={call} annotations={annotations} />

          <AgentSignalsCard
            signals={analysis.agent_signals}
            improvementAreas={analysis.improvement_areas}
            flags={analysis.flags}
          />
        </>
      )}
    </div>
  );
}
