import { llm } from '@livekit/agents';
import { z } from 'zod';

export const scheduleMeeting = llm.tool({
  description: 'Schedule a meeting on the calendar.',
  parameters: z.object({
    title: z.string().describe('Meeting title'),
    datetime: z.string().describe('ISO datetime for the meeting'),
    attendeeEmail: z.string().email().optional().describe('Optional attendee email'),
  }),
  execute: async ({ title, datetime, attendeeEmail }) => {
    return `Scheduled "${title}" for ${datetime}${attendeeEmail ? ` with ${attendeeEmail}` : ''}.`;
  },
});
