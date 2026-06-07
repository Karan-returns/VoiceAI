import 'dotenv/config';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/novatel';

const DEMO_CALLS = [
  {
    callId: 'demo-call-001',
    roomName: 'playground-demo-001',
    jobId: 'seed-job-001',
    startedAt: new Date('2026-06-02T14:00:00Z'),
    endedAt: new Date('2026-06-02T14:04:32Z'),
    status: 'completed' as const,
    promptVersion: 'v1',
    providers: { stt: 'deepgram', llm: 'openai/gpt-4o-mini', tts: 'deepgram' },
    turns: [
      { role: 'agent' as const, content: 'Thank you for calling NovaTel support. My name is Alex. How can I help you today?', timestamp: new Date('2026-06-02T14:00:02Z') },
      { role: 'customer' as const, content: 'Hi, my bill this month is way higher than usual. I was charged twice for the same plan.', timestamp: new Date('2026-06-02T14:00:18Z') },
      { role: 'agent' as const, content: 'I understand that unexpected charges can be frustrating. Let me pull up your account right away.', timestamp: new Date('2026-06-02T14:00:35Z') },
      { role: 'customer' as const, content: 'I already explained this to someone last week and nothing was fixed.', timestamp: new Date('2026-06-02T14:01:02Z') },
      { role: 'agent' as const, content: 'I apologize for the inconvenience. I can see a duplicate charge of $49.99 on March 15. I will submit a refund request now.', timestamp: new Date('2026-06-02T14:01:28Z') },
      { role: 'customer' as const, content: 'How long will the refund take? I need this resolved today.', timestamp: new Date('2026-06-02T14:01:55Z') },
      { role: 'agent' as const, content: 'Refunds typically process within 3 to 5 business days. I have flagged yours as priority given the duplicate charge.', timestamp: new Date('2026-06-02T14:02:20Z') },
      { role: 'customer' as const, content: 'Fine. Is there anything else on my account I should know about?', timestamp: new Date('2026-06-02T14:02:48Z') },
      { role: 'agent' as const, content: 'Your plan renews on the 1st. No other anomalies. Is there anything else I can help with today?', timestamp: new Date('2026-06-02T14:03:10Z') },
      { role: 'customer' as const, content: 'No, that covers it. Thanks.', timestamp: new Date('2026-06-02T14:03:28Z') },
      { role: 'agent' as const, content: 'Thank you for calling NovaTel. Your reference number is REF-8842. Have a great day!', timestamp: new Date('2026-06-02T14:03:45Z') },
    ],
    corrections: [
      { signal: 'sentiment_drop', blockId: 'sentiment_drop', evidence: 'neutral → frustrated', injectedAt: new Date('2026-06-02T14:01:05Z'), latencyMs: 118, turnIndex: 3 },
      { signal: 'dead_air', blockId: 'dead_air', evidence: '4.2s gap before agent response', injectedAt: new Date('2026-06-02T14:01:06Z'), latencyMs: 95, turnIndex: 3 },
    ],
    analysisStatus: 'completed' as const,
    analysis: {
      call_id: 'demo-call-001',
      rubric_score: 72,
      rubric: [
        { id: 'greet_within_5s', label: 'Greet within 5s', passed: true, score: 20, evidence: 'Agent greeted within 2 seconds with name and offer to help.' },
        { id: 'acknowledge_before_solution', label: 'Acknowledge before solution', passed: true, score: 16, evidence: 'Acknowledged frustration before pulling up account on turn 2.' },
        { id: 'policy_explained_clearly', label: 'Policy explained clearly', passed: true, score: 14, evidence: 'Refund timeline stated clearly with priority flag explanation.' },
        { id: 'closed_with_resolution', label: 'Closed with resolution', passed: true, score: 18, evidence: 'Provided reference number and confirmed no other issues.' },
        { id: 'avoided_dead_air', label: 'Avoided dead air', passed: false, score: 4, evidence: '4.2s dead air detected before turn 4 response.' },
      ],
      sentiment_arc: [
        { turn_index: 1, role: 'customer', sentiment: 'frustrated', timestamp: '2026-06-02T14:00:18Z', trigger: 'Duplicate billing charge' },
        { turn_index: 3, role: 'customer', sentiment: 'angry', timestamp: '2026-06-02T14:01:02Z', trigger: 'Prior unresolved contact' },
        { turn_index: 5, role: 'customer', sentiment: 'frustrated', timestamp: '2026-06-02T14:01:55Z', trigger: 'Urgency for same-day resolution' },
        { turn_index: 7, role: 'customer', sentiment: 'neutral', timestamp: '2026-06-02T14:02:48Z', trigger: 'Acceptance of refund timeline' },
        { turn_index: 9, role: 'customer', sentiment: 'positive', timestamp: '2026-06-02T14:03:28Z', trigger: 'Issue resolved' },
      ],
      sentiment_trend: 'improving',
      call_flow: [
        { turn_index: 0, stage: 'Greeting', agent_text_preview: 'Thank you for calling NovaTel support...' },
        { turn_index: 2, stage: 'Discovery', agent_text_preview: 'I understand that unexpected charges...' },
        { turn_index: 4, stage: 'Resolution', agent_text_preview: 'I can see a duplicate charge...' },
        { turn_index: 6, stage: 'Resolution', agent_text_preview: 'Refunds typically process within...' },
        { turn_index: 8, stage: 'Closing', agent_text_preview: 'Your plan renews on the 1st...' },
        { turn_index: 10, stage: 'Closing', agent_text_preview: 'Thank you for calling NovaTel...' },
      ],
      flags: ['dead_air_at_01:06', 'escalation_at_01:02'],
      agent_signals: { filler_words: 3, avg_response_words: 24, unresolved_objections: 0, response_length_assessment: 'balanced' },
      improvement_areas: ['Reduce dead air after customer expresses repeat-contact frustration.', 'Proactively offer callback if refund cannot be expedited.'],
      analyzed_at: '2026-06-02T14:05:00Z',
      prompt_version: 'v1',
      model: 'livekit/openai/gpt-4o-mini',
    },
    createdAt: new Date('2026-06-02T14:00:00Z'),
    updatedAt: new Date('2026-06-02T14:05:00Z'),
  },
  {
    callId: 'demo-call-002',
    roomName: 'playground-demo-002',
    jobId: 'seed-job-002',
    startedAt: new Date('2026-06-03T09:15:00Z'),
    endedAt: new Date('2026-06-03T09:18:48Z'),
    status: 'completed' as const,
    promptVersion: 'v1',
    providers: { stt: 'deepgram', llm: 'openai/gpt-4o-mini', tts: 'deepgram' },
    turns: [
      { role: 'agent' as const, content: 'NovaTel support, Alex speaking. What can I do for you?', timestamp: new Date('2026-06-03T09:15:03Z') },
      { role: 'customer' as const, content: 'I want to cancel. The service is too expensive.', timestamp: new Date('2026-06-03T09:15:20Z') },
      { role: 'agent' as const, content: 'I hear you. Before we process a cancellation, may I review your current plan to see if there is a better fit?', timestamp: new Date('2026-06-03T09:15:42Z') },
      { role: 'customer' as const, content: 'I just want to cancel. Stop trying to upsell me.', timestamp: new Date('2026-06-03T09:16:05Z') },
      { role: 'agent' as const, content: 'Understood. I will start the cancellation. Your service ends at the end of this billing cycle on June 30.', timestamp: new Date('2026-06-03T09:16:28Z') },
      { role: 'customer' as const, content: 'Will I be charged a cancellation fee?', timestamp: new Date('2026-06-03T09:16:50Z') },
      { role: 'agent' as const, content: 'There is no early termination fee on your plan. You will not be charged beyond June 30.', timestamp: new Date('2026-06-03T09:17:08Z') },
      { role: 'agent' as const, content: 'I have sent a confirmation email. Anything else before we wrap up?', timestamp: new Date('2026-06-03T09:17:30Z') },
      { role: 'customer' as const, content: 'No, that is all.', timestamp: new Date('2026-06-03T09:17:42Z') },
    ],
    corrections: [
      { signal: 'escalation_language', blockId: 'escalation_language', evidence: 'Customer used "stop trying to upsell"', injectedAt: new Date('2026-06-03T09:16:08Z'), latencyMs: 142, turnIndex: 3 },
    ],
    analysisStatus: 'completed' as const,
    analysis: {
      call_id: 'demo-call-002',
      rubric_score: 84,
      rubric: [
        { id: 'greet_within_5s', label: 'Greet within 5s', passed: true, score: 18, evidence: 'Greeted within 3 seconds.' },
        { id: 'acknowledge_before_solution', label: 'Acknowledge before solution', passed: true, score: 18, evidence: 'Acknowledged cost concern before retention attempt.' },
        { id: 'policy_explained_clearly', label: 'Policy explained clearly', passed: true, score: 20, evidence: 'Cancellation fee policy explained without jargon.' },
        { id: 'closed_with_resolution', label: 'Closed with resolution', passed: true, score: 20, evidence: 'Confirmation email sent, clean close.' },
        { id: 'avoided_dead_air', label: 'Avoided dead air', passed: true, score: 8, evidence: 'No significant dead air detected.' },
      ],
      sentiment_arc: [
        { turn_index: 1, role: 'customer', sentiment: 'frustrated', timestamp: '2026-06-03T09:15:20Z', trigger: 'Price dissatisfaction' },
        { turn_index: 3, role: 'customer', sentiment: 'angry', timestamp: '2026-06-03T09:16:05Z', trigger: 'Perceived upsell attempt' },
        { turn_index: 5, role: 'customer', sentiment: 'neutral', timestamp: '2026-06-03T09:16:50Z', trigger: 'Direct policy question' },
        { turn_index: 7, role: 'customer', sentiment: 'neutral', timestamp: '2026-06-03T09:17:42Z', trigger: 'Call ending' },
      ],
      sentiment_trend: 'stable',
      call_flow: [
        { turn_index: 0, stage: 'Greeting', agent_text_preview: 'NovaTel support, Alex speaking...' },
        { turn_index: 2, stage: 'Discovery', agent_text_preview: 'Before we process a cancellation...' },
        { turn_index: 4, stage: 'Resolution', agent_text_preview: 'I will start the cancellation...' },
        { turn_index: 6, stage: 'Resolution', agent_text_preview: 'No early termination fee...' },
        { turn_index: 7, stage: 'Closing', agent_text_preview: 'Confirmation email sent...' },
      ],
      flags: ['escalation_at_01:45'],
      agent_signals: { filler_words: 1, avg_response_words: 19, unresolved_objections: 0, response_length_assessment: 'balanced' },
      improvement_areas: ['When customer requests cancellation explicitly, skip retention offer unless policy requires it.'],
      analyzed_at: '2026-06-03T09:08:30Z',
      prompt_version: 'v1',
      model: 'livekit/openai/gpt-4o-mini',
    },
    createdAt: new Date('2026-06-03T09:15:00Z'),
    updatedAt: new Date('2026-06-03T09:08:30Z'),
  },
  {
    callId: 'demo-call-003',
    roomName: 'playground-demo-003',
    jobId: 'seed-job-003',
    startedAt: new Date('2026-06-05T16:30:00Z'),
    endedAt: new Date('2026-06-05T16:33:12Z'),
    status: 'completed' as const,
    promptVersion: 'v1',
    providers: { stt: 'deepgram', llm: 'openai/gpt-4o-mini', tts: 'deepgram' },
    turns: [
      { role: 'agent' as const, content: 'Good afternoon, NovaTel support. This is Alex. How may I assist you?', timestamp: new Date('2026-06-05T16:30:04Z') },
      { role: 'customer' as const, content: 'Why was I charged a late fee? I paid on time.', timestamp: new Date('2026-06-05T16:30:22Z') },
      { role: 'agent' as const, content: 'Let me check your payment history.', timestamp: new Date('2026-06-05T16:30:55Z') },
      { role: 'customer' as const, content: 'Hello? Are you still there?', timestamp: new Date('2026-06-05T16:31:18Z') },
      { role: 'agent' as const, content: 'Yes, sorry for the wait. Your payment posted one day after the due date, which triggered the $5 late fee.', timestamp: new Date('2026-06-05T16:31:35Z') },
      { role: 'customer' as const, content: 'That is ridiculous. I want to speak to a manager.', timestamp: new Date('2026-06-05T16:31:58Z') },
      { role: 'agent' as const, content: 'I understand your frustration. I can waive this fee as a one-time courtesy since your payment was only one day late.', timestamp: new Date('2026-06-05T16:32:20Z') },
      { role: 'customer' as const, content: 'Okay, thank you.', timestamp: new Date('2026-06-05T16:32:45Z') },
      { role: 'agent' as const, content: 'The fee has been waived. You will see the adjustment within 24 hours. Thank you for your patience.', timestamp: new Date('2026-06-05T16:33:00Z') },
    ],
    corrections: [
      { signal: 'dead_air', blockId: 'dead_air', evidence: '6.1s gap', injectedAt: new Date('2026-06-05T16:31:20Z'), latencyMs: 88, turnIndex: 3 },
      { signal: 'escalation_language', blockId: 'escalation_language', evidence: 'speak to a manager', injectedAt: new Date('2026-06-05T16:32:00Z'), latencyMs: 130, turnIndex: 5 },
    ],
    analysisStatus: 'completed' as const,
    analysis: {
      call_id: 'demo-call-003',
      rubric_score: 58,
      rubric: [
        { id: 'greet_within_5s', label: 'Greet within 5s', passed: true, score: 16, evidence: 'Greeted within 4 seconds.' },
        { id: 'acknowledge_before_solution', label: 'Acknowledge before solution', passed: false, score: 6, evidence: 'Jumped to account lookup without acknowledging customer concern.' },
        { id: 'policy_explained_clearly', label: 'Policy explained clearly', passed: true, score: 14, evidence: 'Late fee trigger explained with specific date.' },
        { id: 'closed_with_resolution', label: 'Closed with resolution', passed: true, score: 16, evidence: 'Fee waived with timeline for adjustment.' },
        { id: 'avoided_dead_air', label: 'Avoided dead air', passed: false, score: 6, evidence: '6.1s dead air caused customer to ask if agent was still there.' },
      ],
      sentiment_arc: [
        { turn_index: 1, role: 'customer', sentiment: 'frustrated', timestamp: '2026-06-05T16:30:22Z', trigger: 'Unexpected late fee' },
        { turn_index: 3, role: 'customer', sentiment: 'frustrated', timestamp: '2026-06-05T16:31:18Z', trigger: 'Dead air during lookup' },
        { turn_index: 5, role: 'customer', sentiment: 'angry', timestamp: '2026-06-05T16:31:58Z', trigger: 'Manager request' },
        { turn_index: 7, role: 'customer', sentiment: 'positive', timestamp: '2026-06-05T16:32:45Z', trigger: 'Fee waived' },
      ],
      sentiment_trend: 'improving',
      call_flow: [
        { turn_index: 0, stage: 'Greeting', agent_text_preview: 'Good afternoon, NovaTel support...' },
        { turn_index: 2, stage: 'Discovery', agent_text_preview: 'Let me check your payment history.' },
        { turn_index: 4, stage: 'Resolution', agent_text_preview: 'Payment posted one day after...' },
        { turn_index: 6, stage: 'Escalation', agent_text_preview: 'I can waive this fee as a one-time courtesy...' },
        { turn_index: 8, stage: 'Closing', agent_text_preview: 'Fee has been waived...' },
      ],
      flags: ['dead_air_at_00:55', 'escalation_at_01:58'],
      agent_signals: { filler_words: 2, avg_response_words: 16, unresolved_objections: 1, response_length_assessment: 'too_short' },
      improvement_areas: ['Acknowledge customer concern before account lookup.', 'Set expectations during hold/lookup to prevent dead air anxiety.', 'Offer fee waiver proactively when payment was 1 day late.'],
      analyzed_at: '2026-06-05T16:34:00Z',
      prompt_version: 'v1',
      model: 'livekit/openai/gpt-4o-mini',
    },
    createdAt: new Date('2026-06-05T16:30:00Z'),
    updatedAt: new Date('2026-06-05T16:34:00Z'),
  },
];

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const dbName = new URL(MONGODB_URI).pathname.replace(/^\//, '') || 'novatel';
  const db = client.db(dbName);
  const col = db.collection('conversations');

  for (const call of DEMO_CALLS) {
    await col.updateOne({ callId: call.callId }, { $set: call }, { upsert: true });
    console.log(`Seeded ${call.callId} (score: ${call.analysis.rubric_score})`);
  }

  await client.close();
  console.log(`Done — ${DEMO_CALLS.length} demo calls in ${dbName}.conversations`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
