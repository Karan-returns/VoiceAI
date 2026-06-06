import { llm } from '@livekit/agents';
import { z } from 'zod';

export const getWeather = llm.tool({
  description: 'Get the current weather for a location.',
  parameters: z.object({
    location: z.string().describe('City or region to look up'),
  }),
  execute: async ({ location }) => {
    return `The weather in ${location} is sunny and 72°F.`;
  },
});
