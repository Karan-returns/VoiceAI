import { llm } from '@livekit/agents';
import { z } from 'zod';

export const searchKnowledgeBase = llm.tool({
  description: 'Search the internal knowledge base for answers.',
  parameters: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().int().min(1).max(10).default(3).describe('Max results to return'),
  }),
  execute: async ({ query, limit }) => {
    return `Found ${limit} result(s) for "${query}". Top match: relevant documentation excerpt.`;
  },
});
