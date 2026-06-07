import { useState } from 'react';

import { recordingUrl } from '../api';
import type { ConversationRecording } from '../types';
import { formatFileSize } from '../utils/format';

interface RecordingPanelProps {
  callId: string;
  recording?: ConversationRecording;
}

export default function RecordingPanel({ callId, recording }: RecordingPanelProps) {
  const [playbackError, setPlaybackError] = useState(false);

  const playable = recording?.status === 'stored' && !playbackError;
  const src = playable ? recordingUrl(callId) : undefined;

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Call Recording</h3>
        {recording?.status === 'stored' && recording.sizeBytes ? (
          <span className="text-xs font-mono text-text-muted">{formatFileSize(recording.sizeBytes)}</span>
        ) : null}
      </div>

      <div className="p-5">
        {playable ? (
          <div className="space-y-3">
            <audio
              controls
              preload="metadata"
              src={src}
              className="w-full h-10"
              onError={() => setPlaybackError(true)}
            />
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span className="font-mono truncate max-w-[70%]">{recording.filename ?? `${callId}.mp3`}</span>
              <a
                href={src}
                download={recording.filename ?? `${callId}.mp3`}
                className="text-accent hover:underline no-underline shrink-0"
              >
                Download MP3
              </a>
            </div>
          </div>
        ) : (
          <RecordingUnavailable callId={callId} recording={recording} playbackError={playbackError} />
        )}
      </div>
    </div>
  );
}

function RecordingUnavailable({
  callId,
  recording,
  playbackError,
}: {
  callId: string;
  recording?: ConversationRecording;
  playbackError: boolean;
}) {
  if (playbackError) {
    return (
      <UnavailableMessage
        title="Recording not present"
        detail="Metadata says a recording exists, but the MP3 could not be loaded from storage."
      />
    );
  }

  if (!recording) {
    return (
      <UnavailableMessage
        title="Recording not present"
        detail="No recording was saved for this call. Enable RECORDING_ENABLED on the agent and ensure MongoDB is configured."
      />
    );
  }

  if (recording.status === 'pending') {
    return (
      <UnavailableMessage
        title="Recording processing"
        detail="The call ended recently — the MP3 may still be transcoding and uploading to GridFS."
      />
    );
  }

  if (recording.status === 'failed') {
    return (
      <UnavailableMessage
        title="Recording not present"
        detail={recording.error ? `Capture failed: ${recording.error}` : 'Recording capture failed for this call.'}
      />
    );
  }

  if (recording.status === 'stored') {
    return (
      <UnavailableMessage
        title="Recording not present"
        detail={`Expected ${callId}.mp3 in GridFS but the file is missing.`}
      />
    );
  }

  return (
    <UnavailableMessage
      title="Recording not present"
      detail="No playable recording is available for this call."
    />
  );
}

function UnavailableMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-overlay/30 px-4 py-3">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      <p className="text-xs text-text-muted mt-1 leading-relaxed">{detail}</p>
    </div>
  );
}
