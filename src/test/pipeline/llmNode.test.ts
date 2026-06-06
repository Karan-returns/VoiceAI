import type { llm, voice } from '@livekit/agents';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDefaultLlmNode, mockDebug } = vi.hoisted(() => ({
  mockDefaultLlmNode: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock('@livekit/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@livekit/agents')>();

  return {
    ...actual,
    voice: {
      ...actual.voice,
      Agent: {
        ...actual.voice.Agent,
        default: {
          ...actual.voice.Agent.default,
          llmNode: mockDefaultLlmNode,
        },
      },
    },
  };
});

vi.mock('../../utils/logger.js', () => ({
  createLogger: () => ({
    debug: mockDebug,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { runLlmNode } from '../../pipeline/llmNode.js';

function createMockStream(): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue('token');
      controller.close();
    },
  });
}

describe('runLlmNode', () => {
  const agent = {} as voice.Agent;
  const toolCtx = {} as llm.ToolContext;
  const modelSettings = {} as voice.ModelSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDefaultLlmNode.mockResolvedValue(createMockStream());
  });

  it('delegates to the framework default llmNode implementation', async () => {
    const chatCtx = { items: [{ content: 'What is my bill?' }] } as llm.ChatContext;
    const expectedStream = createMockStream();
    mockDefaultLlmNode.mockResolvedValue(expectedStream);

    const result = await runLlmNode(agent, chatCtx, toolCtx, modelSettings);

    expect(mockDefaultLlmNode).toHaveBeenCalledOnce();
    expect(mockDefaultLlmNode).toHaveBeenCalledWith(agent, chatCtx, toolCtx, modelSettings);
    expect(result).toBe(expectedStream);
  });

  it('logs the last user message content when present', async () => {
    const chatCtx = {
      items: [{ role: 'assistant', content: 'Hi there' }, { role: 'user', content: 'Check my balance' }],
    } as llm.ChatContext;

    await runLlmNode(agent, chatCtx, toolCtx, modelSettings);

    expect(mockDebug).toHaveBeenCalledOnce();
    expect(mockDebug).toHaveBeenCalledWith(
      { content: 'Check my balance' },
      'LLM input',
    );
  });

  it('does not log when chat context is empty', async () => {
    const chatCtx = { items: [] } as llm.ChatContext;

    await runLlmNode(agent, chatCtx, toolCtx, modelSettings);

    expect(mockDebug).not.toHaveBeenCalled();
  });

  it('does not log when the last item has no content field', async () => {
    const chatCtx = {
      items: [{ type: 'function_call', name: 'lookup_bill' }],
    } as unknown as llm.ChatContext;

    await runLlmNode(agent, chatCtx, toolCtx, modelSettings);

    expect(mockDebug).not.toHaveBeenCalled();
  });

  it('returns null when the framework default returns null', async () => {
    const chatCtx = { items: [{ content: 'Hello' }] } as llm.ChatContext;
    mockDefaultLlmNode.mockResolvedValue(null);

    const result = await runLlmNode(agent, chatCtx, toolCtx, modelSettings);

    expect(result).toBeNull();
  });
});
