import { initializeLogger, llm, voice } from '@livekit/agents';
import type { ReadableStream } from 'node:stream/web';

import { NovaTelAgent } from '../agents/NovaTelAgent.js';
import { config } from '../config/index.js';
import { runLlmNode } from '../pipeline/llmNode.js';
import { createProviders } from '../providers/index.js';

const defaultQuestions = [
  'What is my current bill balance?',
  'My account ends in 4521.',
  'Why was there a late fee on my last bill?',
];

const questions =
  process.argv.length > 2 ? process.argv.slice(2) : defaultQuestions;

interface StreamResult {
  text: string;
  toolCalls: llm.FunctionCall[];
}

async function consumeStream(
  stream: ReadableStream<llm.ChatChunk | string>,
): Promise<StreamResult> {
  const reader = stream.getReader();
  let text = '';
  const toolCalls: llm.FunctionCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (typeof value === 'string') {
      text += value;
      process.stdout.write(value);
      continue;
    }

    const delta = value.delta;
    if (!delta) {
      continue;
    }

    if (delta.toolCalls) {
      for (const tool of delta.toolCalls) {
        if (tool.type !== 'function_call') {
          continue;
        }

        toolCalls.push(
          llm.FunctionCall.create({
            callId: tool.callId,
            name: tool.name,
            args: tool.args,
            thoughtSignature: tool.thoughtSignature,
            extra: tool.extra ?? {},
          }),
        );
      }
    }

    if (delta.content) {
      text += delta.content;
      process.stdout.write(delta.content);
    }
  }

  if (text.length > 0) {
    process.stdout.write('\n');
  }

  return { text, toolCalls };
}

async function runAssistantTurn(
  agent: voice.Agent,
  chatCtx: llm.ChatContext,
  toolCtx: llm.ToolContext,
): Promise<string> {
  const maxToolRounds = 5;

  for (let round = 0; round < maxToolRounds; round++) {
    const stream = await runLlmNode(agent, chatCtx, toolCtx, {});

    if (!stream) {
      return '';
    }

    const { text, toolCalls } = await consumeStream(stream);

    if (toolCalls.length === 0) {
      if (text) {
        chatCtx.addMessage({ role: 'assistant', content: text });
      }
      return text;
    }

    for (const toolCall of toolCalls) {
      chatCtx.insert(toolCall);
      console.log(`[tool] ${toolCall.name}(${toolCall.args})`);

      const output = await llm.executeToolCall(toolCall, toolCtx);
      chatCtx.insert(output);
    }

    if (text) {
      chatCtx.addMessage({ role: 'assistant', content: text });
    }
  }

  return '';
}

async function main(): Promise<void> {
  initializeLogger({ pretty: true, level: config.logLevel });

  const providers = createProviders(config);
  const agent = new NovaTelAgent();

  const session = new voice.AgentSession({
    llm: providers.llm,
    connOptions: {
      llmConnOptions: { maxRetry: 2, retryIntervalMs: 500, timeoutMs: 15000 },
    },
  });

  await session.start({ agent });

  const chatCtx = llm.ChatContext.empty();

  for (const question of questions) {
    chatCtx.addMessage({ role: 'user', content: question });

    console.log('\nUser:', question);
    console.log('Assistant:');

    await runAssistantTurn(agent, chatCtx, agent.toolCtx);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
