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

export class NovaTelAgent extends voiceNs.Agent {
  private readonly pipelineConfig: PipelineConfig;

  constructor(pipeline: PipelineConfig) {
    super({
      instructions: NOVATEL_SUPPORT_PROMPT_V1,
      tools: billingTools,
    });
    this.pipelineConfig = pipeline;
  }

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

  override async sttNode(
    audio: ReadableStream<AudioFrame>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<stt.SpeechEvent | string> | null> {
    return voiceNs.Agent.default.sttNode(this, audio, modelSettings);
  }

  override async llmNode(
    chatCtx: llm.ChatContext,
    toolCtx: llm.ToolContext,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    return runLlmNode(this, chatCtx, toolCtx, modelSettings);
  }

  override async ttsNode(
    text: ReadableStream<string>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<AudioFrame> | null> {
    return runTtsNode(this, text, modelSettings);
  }
}
