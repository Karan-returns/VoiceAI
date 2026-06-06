import { voice, type llm } from '@livekit/agents';

import { appendMidCallCorrection } from '../../db/conversationRepository.js';
import { createLogger } from '../../utils/logger.js';
import { correctionBlockFor } from './correctionBlocks.js';
import { injectCorrectionBlock } from './inject.js';
import {
  agentAddressedObjection,
  detectEscalationLanguage,
  detectObjectionTopic,
  pickHighestPrioritySignal,
  scoreSentiment,
  sentimentDropLevels,
} from './signals.js';
import type {
  CorrectionSignal,
  InjectedCorrection,
  PendingCorrection,
  SentimentLevel,
} from './types.js';
import { DEAD_AIR_GRACE_MS, DEAD_AIR_THRESHOLD_MS } from './types.js';

const logger = createLogger('midCallCorrection');

interface FlaggedSignal {
  signal: CorrectionSignal;
  evidence?: string;
  detectedAt: number;
}

export interface MidCallCorrectionMonitorOptions {
  callId?: string;
  deadAirThresholdMs?: number;
}

export class MidCallCorrectionMonitor {
  private readonly callId?: string;
  private readonly deadAirThresholdMs: number;

  private flaggedSignals: FlaggedSignal[] = [];
  private lastCustomerSentiment: SentimentLevel = 'neutral';
  private lastAgentText = '';
  private objectionCounts = new Map<string, number>();
  private customerTurnCount = 0;
  private injectedCorrections: InjectedCorrection[] = [];

  private deadAirTimer: ReturnType<typeof setTimeout> | undefined;
  private agentListeningSince: number | undefined;
  private userState: voice.UserState = 'listening';
  private agentState: voice.AgentState = 'initializing';

  constructor(options: MidCallCorrectionMonitorOptions = {}) {
    if (options.callId !== undefined) {
      this.callId = options.callId;
    }
    this.deadAirThresholdMs = options.deadAirThresholdMs ?? DEAD_AIR_THRESHOLD_MS;
  }

  attach(session: voice.AgentSession): void {
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      this.onTranscript(ev.transcript);
    });

    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      if (ev.item.type !== 'message') {
        return;
      }
      this.onConversationMessage(ev.item);
    });

    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      this.userState = ev.newState;
      this.evaluateDeadAir();
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      this.agentState = ev.newState;
      if (ev.newState === 'listening') {
        this.agentListeningSince = Date.now();
      } else {
        this.agentListeningSince = undefined;
        this.clearDeadAirTimer();
      }
      this.evaluateDeadAir();
    });

    session.on(voice.AgentSessionEventTypes.Close, () => {
      this.clearDeadAirTimer();
    });
  }

  applyToTurn(chatCtx: llm.ChatContext, userMessage?: llm.ChatMessage): InjectedCorrection | null {
    if (userMessage?.textContent?.trim()) {
      this.customerTurnCount += 1;
      this.clearDeadAirTimer();
      this.refreshSignalsFromFinalTranscript(userMessage);
    }

    const start = Date.now();
    const pending = this.consumePendingCorrection();
    if (!pending) {
      return null;
    }

    injectCorrectionBlock(chatCtx, pending.block);

    const injected: InjectedCorrection = {
      signal: pending.signal,
      blockId: pending.signal,
      injectedAt: Date.now(),
      latencyMs: Date.now() - start,
      turnIndex: this.customerTurnCount,
      ...(pending.evidence ? { evidence: pending.evidence } : {}),
    };

    this.injectedCorrections.push(injected);

    logger.info(
      {
        signal: injected.signal,
        evidence: injected.evidence,
        latencyMs: injected.latencyMs,
        turnIndex: injected.turnIndex,
        callId: this.callId,
      },
      'Mid-call correction injected',
    );

    if (this.callId) {
      void appendMidCallCorrection(this.callId, injected).catch((err) => {
        logger.error({ err, callId: this.callId }, 'Failed to persist mid-call correction');
      });
    }

    return injected;
  }

  getHistory(): readonly InjectedCorrection[] {
    return this.injectedCorrections;
  }

  private onTranscript(transcript: string): void {
    const match = detectEscalationLanguage(transcript);
    if (match) {
      this.flagSignal('escalation_language', match);
    }
  }

  private onConversationMessage(message: llm.ChatMessage): void {
    const text = message.textContent?.trim();
    if (!text) {
      return;
    }

    if (message.role === 'assistant') {
      this.lastAgentText = text;
      return;
    }

  }

  private evaluateDeadAir(): void {
    const waitingForUser =
      this.agentState === 'listening' && this.userState !== 'speaking' && this.agentListeningSince;

    if (!waitingForUser) {
      this.clearDeadAirTimer();
      return;
    }

    if (this.deadAirTimer) {
      return;
    }

    const listeningSince = this.agentListeningSince!;
    const totalRequired = DEAD_AIR_GRACE_MS + this.deadAirThresholdMs;
    const remaining = totalRequired - (Date.now() - listeningSince);
    const delay = Math.max(0, remaining);

    this.deadAirTimer = setTimeout(() => {
      this.deadAirTimer = undefined;
      if (this.agentState !== 'listening' || this.userState === 'speaking') {
        return;
      }

      const silentFor = Date.now() - (this.agentListeningSince ?? Date.now());
      if (silentFor < totalRequired) {
        this.evaluateDeadAir();
        return;
      }

      this.flagSignal('dead_air', `${this.deadAirThresholdMs}ms silence after grace`);
    }, delay);
  }

  private refreshSignalsFromFinalTranscript(userMessage: llm.ChatMessage): void {
    const finalText = userMessage.textContent?.trim();
    if (!finalText) {
      return;
    }

    const escalation = detectEscalationLanguage(finalText);
    if (escalation) {
      this.flagSignal('escalation_language', escalation);
      this.flaggedSignals = this.flaggedSignals.filter((entry) => entry.signal !== 'dead_air');
    }

    const currentSentiment = scoreSentiment(finalText);
    const drop = sentimentDropLevels(this.lastCustomerSentiment, currentSentiment);
    if (drop >= 2) {
      this.flagSignal('sentiment_drop', `${this.lastCustomerSentiment} -> ${currentSentiment}`);
    }
    this.lastCustomerSentiment = currentSentiment;

    const topic = detectObjectionTopic(finalText);
    if (topic && this.lastAgentText) {
      const addressed = agentAddressedObjection(this.lastAgentText, topic);
      if (!addressed) {
        const count = (this.objectionCounts.get(topic) ?? 0) + 1;
        this.objectionCounts.set(topic, count);
        if (count >= 2) {
          this.flagSignal('unanswered_objection', topic);
        }
      } else {
        this.objectionCounts.delete(topic);
      }
    }
  }

  private flagSignal(signal: CorrectionSignal, evidence?: string): void {
    const existing = this.flaggedSignals.find((entry) => entry.signal === signal);
    if (existing) {
      if (evidence) {
        existing.evidence = evidence;
      }
      existing.detectedAt = Date.now();
      return;
    }

    this.flaggedSignals.push({
      signal,
      ...(evidence ? { evidence } : {}),
      detectedAt: Date.now(),
    });

    logger.info(
      { signal, evidence, callId: this.callId },
      'Mid-call correction signal detected',
    );
  }

  private consumePendingCorrection(): PendingCorrection | null {
    if (this.flaggedSignals.length === 0) {
      return null;
    }

    const chosen = pickHighestPrioritySignal(this.flaggedSignals);
    if (!chosen) {
      return null;
    }

    this.flaggedSignals = this.flaggedSignals.filter((entry) => entry.signal !== chosen.signal);

    return {
      signal: chosen.signal,
      block: correctionBlockFor(chosen.signal),
      detectedAt: Date.now(),
      ...(chosen.evidence ? { evidence: chosen.evidence } : {}),
    };
  }

  private clearDeadAirTimer(): void {
    if (this.deadAirTimer) {
      clearTimeout(this.deadAirTimer);
      this.deadAirTimer = undefined;
    }
  }
}
