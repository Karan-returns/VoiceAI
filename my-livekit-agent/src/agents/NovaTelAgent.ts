import type { llm, stt, voice } from '@livekit/agents';
import { voice as voiceNs } from '@livekit/agents';
import type { TimedString } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import type { ReadableStream } from 'node:stream/web';

import { runLlmNode } from '../pipeline/llmNode.js';
import { runTranscriptionNode } from '../pipeline/sttNode.js';
import { runTtsNode } from '../pipeline/ttsNode.js';
import { injectBillingPrefetchIfDigits } from '../services/billingPrefetch.js';
import type { MidCallCorrectionMonitor } from '../services/midCallCorrection/monitor.js';
import { billingTools } from '../tools/billing.js';
import { pruneOrphanToolItems } from '../utils/pruneOrphanToolItems.js';

/**
 * NovaTel billing support agent.
 *
 * This class overrides pipeline hooks from the base Agent class.
 * Think of each hook as a virtual method you can customize:
 *
 *   audio -> sttNode() -> transcriptionNode() -> llmNode() -> ttsNode() -> audio
 */
export class NovaTelAgent extends voiceNs.Agent {
  private correctionMonitor: MidCallCorrectionMonitor | undefined;

  constructor(instructions: string) {
    super({
      instructions,
      tools: billingTools,
    });
  }

  setCorrectionMonitor(monitor: MidCallCorrectionMonitor): void {
    this.correctionMonitor = monitor;
  }

  override async onUserTurnCompleted(
    chatCtx: llm.ChatContext,
    newMessage: llm.ChatMessage,
  ): Promise<void> {
    pruneOrphanToolItems(chatCtx);
    this.correctionMonitor?.applyToTurn(chatCtx, newMessage);

    const userText = newMessage.textContent?.trim();
    if (userText) {
      await injectBillingPrefetchIfDigits(chatCtx, userText);
    }
  }

  override async transcriptionNode(
    text: ReadableStream<string | TimedString>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<string | TimedString> | null> {
    return runTranscriptionNode(this, text, modelSettings);
  }

  // Stage 1a: speech-to-text (uses framework default).
  override async sttNode(
    audio: ReadableStream<AudioFrame>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<stt.SpeechEvent | string> | null> {
    return voiceNs.Agent.default.sttNode(this, audio, modelSettings);
  }

  // Stage 2: language model response generation.
  override async llmNode(
    chatCtx: llm.ChatContext,
    toolCtx: llm.ToolContext,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    return runLlmNode(this, chatCtx, toolCtx, modelSettings);
  }

  // Stage 3: text-to-speech audio generation.
  override async ttsNode(
    text: ReadableStream<string>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<AudioFrame> | null> {
    return runTtsNode(this, text, modelSettings);
  }
}
