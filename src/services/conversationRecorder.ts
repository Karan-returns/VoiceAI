import { voice, type llm } from '@livekit/agents';

import type { AppConfig } from '../config/types.js';
import {
  appendTurn,
  createConversation,
  finalizeConversation,
  markConversationFailed,
} from '../db/conversationRepository.js';
import type { ConversationTurn } from '../db/types.js';
import type { CallIdentity } from '../utils/callIdentity.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('conversationRecorder');

const PROMPT_VERSION = 'v1';

function mapChatMessage(item: llm.ChatMessage, createdAt: number): ConversationTurn | null {
  const text = item.textContent?.trim();
  if (!text) {
    return null;
  }

  if (item.role === 'user') {
    return {
      role: 'customer',
      content: text,
      timestamp: new Date(createdAt),
      ...(item.interrupted ? { interrupted: true } : {}),
    };
  }

  if (item.role === 'assistant') {
    return {
      role: 'agent',
      content: text,
      timestamp: new Date(createdAt),
      ...(item.interrupted ? { interrupted: true } : {}),
    };
  }

  return null;
}

export class ConversationRecorder {
  private readonly identity: CallIdentity;
  private readonly startedAt = new Date();
  private finalized = false;

  constructor(
    private readonly config: AppConfig,
    identity: CallIdentity,
  ) {
    this.identity = identity;
  }

  async start(): Promise<void> {
    const now = new Date();

    await createConversation({
      callId: this.identity.callId,
      roomName: this.identity.roomName,
      jobId: this.identity.jobId,
      startedAt: this.startedAt,
      status: 'active',
      promptVersion: PROMPT_VERSION,
      providers: {
        stt: `${this.config.stt.provider}/${this.config.stt.model}`,
        llm: `${this.config.llm.provider}/${this.config.llm.model}`,
        tts: `${this.config.tts.provider}/${this.config.tts.model}`,
      },
      turns: [],
      createdAt: now,
      updatedAt: now,
    });

    logger.info(
      { callId: this.identity.callId, roomName: this.identity.roomName, jobId: this.identity.jobId },
      'Conversation document created',
    );
  }

  attach(session: voice.AgentSession): void {
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev: voice.ConversationItemAddedEvent) => {
      if (ev.item.type !== 'message') {
        return;
      }

      const turn = mapChatMessage(ev.item, ev.createdAt);
      if (!turn) {
        return;
      }

      void appendTurn(this.identity.callId, turn).catch((err) => {
        logger.error({ err, callId: this.identity.callId }, 'Failed to append conversation turn');
      });
    });

    session.on(voice.AgentSessionEventTypes.Close, (ev: voice.CloseEvent) => {
      void this.finalize('completed', ev.reason, session.usage).catch((err) => {
        logger.error({ err, callId: this.identity.callId }, 'Failed to finalize conversation on close');
      });
    });
  }

  async finalize(
    status: 'completed' | 'failed',
    closeReason?: string,
    usage?: unknown,
  ): Promise<void> {
    if (this.finalized) {
      return;
    }
    this.finalized = true;

    await finalizeConversation(this.identity.callId, {
      endedAt: new Date(),
      status,
      ...(closeReason ? { closeReason } : {}),
      ...(usage ? { usage } : {}),
    });

    logger.info(
      { callId: this.identity.callId, status, closeReason },
      'Conversation saved to MongoDB',
    );
  }

  async fail(reason: string): Promise<void> {
    if (this.finalized) {
      return;
    }
    this.finalized = true;

    await markConversationFailed(this.identity.callId, reason);
    logger.info({ callId: this.identity.callId, reason }, 'Conversation marked failed in MongoDB');
  }
}

export function attachConversationRecorder(
  session: voice.AgentSession,
  config: AppConfig,
  identity: CallIdentity,
): ConversationRecorder {
  const recorder = new ConversationRecorder(config, identity);
  recorder.attach(session);
  return recorder;
}
