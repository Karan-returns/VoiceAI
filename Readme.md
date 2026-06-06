# NovaTel Voice Agent — Step 1 (Backend)

LiveKit voice agent worker for **NovaTel** billing support (IntellifyAI assessment).  
Pipeline: **LiveKit WebRTC → Deepgram STT → LiveKit Inference LLM → Deepgram TTS**.

No custom frontend in this repo — test calls via [LiveKit Agents Playground](https://agents-playground.livekit.io).

## Architecture

```
Browser (Playground)  ──WebRTC──►  LiveKit Cloud  ──dispatch──►  my-livekit-agent worker
                                         │
                                    STT → LLM → TTS
                                   (Deepgram) (Inference) (Deepgram Aura)
```

## Prerequisites

- Node.js 22+
- LiveKit Cloud project with **Inference** enabled
- Deepgram API key
- **No OpenAI key** — LLM uses LiveKit Inference with your `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`

## Setup

```bash
cd my-livekit-agent
cp .env.example .env
# Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, DEEPGRAM_API_KEY

npm install
npm run dev
```

## Talk to the agent

1. Keep `npm run dev` running (worker registers with LiveKit Cloud).
2. Open https://agents-playground.livekit.io
3. Enter the same LiveKit URL, API key, and API secret from `.env`.
4. Click **Connect** and allow microphone access.
5. Alex (NovaTel support) should greet you and handle billing scenarios.

## Step 1 checklist

| Requirement | Where |
|-------------|--------|
| LiveKit WebRTC transport | Playground + worker in `src/agent.ts` |
| STT: Deepgram Nova-2 | `providers/stt/deepgram.ts` |
| LLM: GPT-4o (via Inference) | `providers/llm/livekit.ts`, `LLM_MODEL=openai/gpt-4o-mini` |
| TTS: voice output | `providers/tts/deepgram.ts` (Aura) |
| NovaTel billing persona | `src/prompts/novaTelSupport.v1.ts` |
| Interruptions | `turnHandling.interruption` in `agent.ts` |
| Low latency | Preemptive generation + dynamic endpointing |
| Clean STT → LLM → TTS | `providers/` + `pipeline/` |

## Prompt v1 (submission)

`my-livekit-agent/src/prompts/novaTelSupport.v1.ts` → `NOVATEL_SUPPORT_PROMPT_V1`

## Test phrases

- "My bill this month is wrong — I was charged twice."
- "I want to cancel my plan, it's too expensive."
- "Why was I charged a late fee? I paid on time."
- "I want to speak to a manager."

## Project layout

```
VoiceAgent/
└── my-livekit-agent/
    ├── src/
    │   ├── agent.ts              # Worker entrypoint
    │   ├── agents/NovaTelAgent.ts  # Single NovaTel billing support agent
    │   ├── config/               # Env-based provider selection
    │   ├── pipeline/             # STT/LLM/TTS node hooks
    │   ├── analysis/           # Post-call QA pipeline (Step 3)
    │   ├── prompts/              # Agent + analysis prompts
    │   ├── db/                   # MongoDB client + conversation repository
    │   ├── services/             # Conversation recorder
    │   ├── providers/            # STT, LLM, TTS factories
    │   └── tools/                # Billing lookup, escalation stubs
    ├── .env.example
    └── package.json
```

## Step 3 — AI call analysis pipeline

After each completed call, the worker runs a **hybrid analysis pipeline**:

1. **Heuristics** (deterministic) — filler words, dead-air gaps, escalation keywords, avg response length
2. **LLM analysis** (GPT via LiveKit Inference) — QA rubric, call-flow stages, sentiment arc, unresolved objections

Results are saved on the conversation document as `analysis`.

### Prompts (submission)

`my-livekit-agent/src/prompts/callAnalysis.v1.ts`

- `CALL_ANALYSIS_SYSTEM_PROMPT_V1` — rubric, call-flow, sentiment, objection rules
- `CALL_ANALYSIS_USER_PROMPT_V1` — transcript + heuristic hints template

### Scorecard JSON shape

```json
{
  "call_id": "playground-room-abc",
  "rubric_score": 72,
  "rubric": [{ "id": "greet_within_5s", "passed": true, "score": 20, "evidence": "..." }],
  "sentiment_arc": [{ "turn_index": 1, "role": "customer", "sentiment": "frustrated", "timestamp": "..." }],
  "sentiment_trend": "deteriorating",
  "call_flow": [{ "turn_index": 0, "stage": "Greeting", "agent_text_preview": "..." }],
  "flags": ["dead_air_at_00:42", "escalation_at_01:15"],
  "agent_signals": {
    "filler_words": 8,
    "avg_response_words": 28,
    "unresolved_objections": 1,
    "response_length_assessment": "balanced"
  },
  "improvement_areas": ["Acknowledge frustration before quoting policy."],
  "analyzed_at": "...",
  "prompt_version": "v1",
  "model": "openai/gpt-4o-mini"
}
```

### Manual analysis

```bash
cd my-livekit-agent
npm run analyze:call -- <callId>    # one call
npm run analyze:call -- --all       # all pending completed calls
```

Set `CALL_ANALYSIS_ENABLED=false` to skip automatic post-call analysis.

## Later steps (not built yet)

- Step 2: Recording audio file + diarized transcript enrichment
- Step 4: Report dashboard
- Step 5: Self-healing prompt loops

## MongoDB — store conversations

Each call is saved to MongoDB when `MONGODB_URI` is set.

### Setup

1. Install and start MongoDB locally (or use MongoDB Atlas).
2. Add to `my-livekit-agent/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/novatel
```

3. Open **MongoDB Compass** → **New Connection** → paste the same URI → Connect.
4. Database: `novatel` · Collection: `conversations`

### Document shape

```json
{
  "callId": "playground-room-abc",
  "roomName": "playground-room-abc",
  "startedAt": "...",
  "endedAt": "...",
  "status": "completed",
  "promptVersion": "v1",
  "providers": { "stt": "deepgram/nova-2-general", "llm": "...", "tts": "..." },
  "turns": [
    { "role": "agent", "content": "Thank you for calling NovaTel...", "timestamp": "..." },
    { "role": "customer", "content": "My bill is wrong...", "timestamp": "..." }
  ],
  "analysisStatus": "completed",
  "analysis": { "call_id": "...", "rubric_score": 72, "sentiment_arc": [], "call_flow": [], "flags": [], "agent_signals": {} }
}
```

Turns are appended live during the call; the document is finalized when the call ends.

