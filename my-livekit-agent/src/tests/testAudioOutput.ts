import type { AudioFrame } from '@livekit/rtc-node';
import { voice } from '@livekit/agents';
import { EventEmitter } from 'node:events';

/** Minimal audio sink so the session runs TTS and emits playbackStarted. */
export class TestAudioOutput extends EventEmitter {
  static readonly EVENT_PLAYBACK_STARTED = 'playbackStarted';
  static readonly EVENT_PLAYBACK_FINISHED = 'playbackFinished';

  sampleRate = 24_000;
  readonly canPause = false;

  private capturing = false;
  private playbackFinishedCount = 0;
  private playbackSegmentsCount = 0;
  private playbackWaiters: Array<() => void> = [];
  private lastPlaybackEvent = { playbackPosition: 0, interrupted: false };
  private firstFrameEmitted = false;

  async captureFrame(frame: AudioFrame): Promise<void> {
    if (!this.capturing) {
      this.capturing = true;
      this.playbackSegmentsCount++;
    }

    if (!this.firstFrameEmitted) {
      this.firstFrameEmitted = true;
      this.emit(TestAudioOutput.EVENT_PLAYBACK_STARTED, { createdAt: Date.now() });
    }

    this.lastPlaybackEvent.playbackPosition += frame.samplesPerChannel / frame.sampleRate;
  }

  flush(): void {
    this.capturing = false;
    if (this.playbackSegmentsCount > this.playbackFinishedCount) {
      this.playbackFinishedCount++;
      this.firstFrameEmitted = false;
      this.resolveWaiters();
      this.emit(TestAudioOutput.EVENT_PLAYBACK_FINISHED, this.lastPlaybackEvent);
      this.lastPlaybackEvent = { playbackPosition: 0, interrupted: false };
    }
  }

  clearBuffer(): void {
    this.lastPlaybackEvent.interrupted = true;
    this.flush();
  }

  async waitForPlayout(): Promise<{ playbackPosition: number; interrupted: boolean }> {
    const target = this.playbackSegmentsCount;
    while (this.playbackFinishedCount < target) {
      await new Promise<void>((resolve) => {
        this.playbackWaiters.push(resolve);
      });
    }
    return this.lastPlaybackEvent;
  }

  pause(): void {}
  resume(): void {}
  onAttached(): void {}
  onDetached(): void {}

  private resolveWaiters(): void {
    const waiters = this.playbackWaiters;
    this.playbackWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }
}

export interface TurnLatencySnapshot {
  firstTtsMs: number;
  replyCompleteMs: number;
  firstSpeechSource: string;
}

export class TurnLatencyWatch {
  private userTurnCompletedAt: number | null = null;
  private firstTtsMs: number | null = null;
  private replyCompleteMs: number | null = null;
  private firstSpeechSource: string | null = null;
  private readonly detach: () => void;

  constructor(session: voice.AgentSession, audio: TestAudioOutput) {
    const onPlaybackStarted = (): void => {
      if (this.userTurnCompletedAt === null || this.firstTtsMs !== null) {
        return;
      }
      this.firstTtsMs = Date.now() - this.userTurnCompletedAt;
    };

    const onSpeech = (ev: voice.SpeechCreatedEvent): void => {
      if (this.userTurnCompletedAt === null || this.firstSpeechSource !== null) {
        return;
      }
      this.firstSpeechSource = ev.source;
    };

    audio.on(TestAudioOutput.EVENT_PLAYBACK_STARTED, onPlaybackStarted);
    session.on(voice.AgentSessionEventTypes.SpeechCreated, onSpeech);

    this.detach = () => {
      audio.off(TestAudioOutput.EVENT_PLAYBACK_STARTED, onPlaybackStarted);
      session.off(voice.AgentSessionEventTypes.SpeechCreated, onSpeech);
    };
  }

  beginTurn(): void {
    this.userTurnCompletedAt = Date.now();
    this.firstTtsMs = null;
    this.replyCompleteMs = null;
    this.firstSpeechSource = null;
  }

  endTurn(): void {
    if (this.userTurnCompletedAt !== null) {
      this.replyCompleteMs = Date.now() - this.userTurnCompletedAt;
    }
  }

  snapshot(): TurnLatencySnapshot {
    return {
      firstTtsMs: this.firstTtsMs ?? -1,
      replyCompleteMs: this.replyCompleteMs ?? -1,
      firstSpeechSource: this.firstSpeechSource ?? 'unknown',
    };
  }

  close(): void {
    this.detach();
  }
}
