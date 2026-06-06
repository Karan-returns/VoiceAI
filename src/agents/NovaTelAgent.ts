import type { llm, stt, voice } from '@livekit/agents';
import { voice as voiceNs } from '@livekit/agents';
import type { TimedString } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import type { ReadableStream } from 'node:stream/web';

import type { PipelineConfig } from '../config/types.js';
import { runLlmNode } from '../pipeline/llmNode.js';
import { runTranscriptionNode } from '../pipeline/sttNode.js';
import { runTtsNode } from '../pipeline/ttsNode.js';
import { NOVATEL_SUPPORT_PROMPT_V1 } from '../prompts/novaTelSupport.v1.js';
import { billingTools } from '../tools/billing.js';

/**
 * NovaTel billing support agent.
 *
 * This class overrides pipeline hooks from the base Agent class.
 * Think of each hook as a virtual method you can customize:
 *
 *   audio -> sttNode() -> transcriptionNode() -> llmNode() -> ttsNode() -> audio
 */
export class NovaTelAgent extends voiceNs.Agent {
  private readonly pipelineConfig: PipelineConfig;

  constructor(pipeline: PipelineConfig) {
    super({
      instructions: NOVATEL_SUPPORT_PROMPT_V1,
      tools: billingTools,
    });
    this.pipelineConfig = pipeline;
  }

  // Stage 1b: clean transcript text (optional filler-word removal).
  override async transcriptionNode(
    text: ReadableStream<string | TimedString>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<string | TimedString> | null> {
    return runTranscriptionNode(
      this,
      text,
      modelSettings,
      this.pipelineConfig.removeFillerWords,
    );
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
