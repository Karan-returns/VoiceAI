# NovaTel Voice Agent — Deliverables

Submission for the IntellifyAI assessment. Each item below maps directly to a common rejection reason and shows how this repo addresses it.

---

## 1. Self-healing loop (dashboard + feedback mechanism)

The system closes the loop in **two layers**, not just a read-only dashboard.

### Loop 1 — Mid-call correction (real time)

While the call is live, `MidCallCorrectionMonitor` watches sentiment, dead air, and escalation signals. When a threshold is crossed, it injects a targeted correction into the agent's context so the *current* call can recover without waiting for post-call review.

- Code: `my-livekit-agent/src/services/midCallCorrection/`
- Corrections are persisted on the conversation document and surfaced in the dashboard transcript annotations.

### Loop 2 — Post-call prompt evolution (between calls)

After analysis completes, recurring failures (especially Loop 1 corrections that fired ≥2 times, failed rubric items, and `improvement_areas`) trigger automatic prompt patching:

1. Extract failures → 2. Generate a single-section patch via meta-prompt → 3. Save new version to `agent_prompts` → 4. Activate for the next call

- Code: `my-livekit-agent/src/services/promptEvolution/`
- Wired from analysis: `callAnalysisService.ts` calls `evolvePromptAfterCall()` after every successful scorecard.

### Dashboard — visual feedback, not raw JSON

The QA dashboard reads analyzed conversations from MongoDB and renders the feedback the loops produce:

| What you see | Where |
|---|---|
| Rubric pass/fail with **evidence quotes** | `dashboard/src/components/RubricCard.tsx` |
| Sentiment arc + call-flow timeline | `SentimentChart.tsx`, `CallFlowTimeline.tsx` |
| Transcript with inline flags & corrections | `TranscriptPanel.tsx` |
| Cross-call score/flag trends | `TrendComparison.tsx` on the list page |
| Agent signals + coaching notes | `AgentSignalsCard.tsx` |

**Run it:**

```bash
cd dashboard
cp .env.example .env   # same MONGODB_URI as the agent
npm install
npm run dev              # UI → http://localhost:5173
```

**Audit prompt evolution manually:**

```bash
cd my-livekit-agent
npm run evolve:prompt -- list
npm run evolve:prompt -- show
npm run evolve:prompt -- rollback v2
```

---

## 2. Prompts submitted (AI thinking artifacts)

All prompts are versioned source files in the repo — not buried in code strings.

| Prompt | File | Purpose |
|---|---|---|
| **Agent v1** | `my-livekit-agent/src/prompts/novaTelSupport.v1.ts` | NovaTel billing persona (Alex), voice rules, policies, tool usage |
| **Call analysis v1** | `my-livekit-agent/src/prompts/callAnalysis.v1.ts` | QA rubric, sentiment arc, call-flow stages, coaching notes |
| **Prompt evolution v1** | `my-livekit-agent/src/prompts/promptEvolution.v1.ts` | Meta-prompt for targeted single-section patches |

The agent prompt is seeded into MongoDB on first worker start (`agent_prompts` collection) and evolved versions are stored with `parentVersion`, `triggeredByCallId`, and `failuresAddressed` for audit.

---

## 3. Analysis grounded in the actual transcript (no hallucinated QA)

Analysis is **hybrid**: deterministic heuristics first, then LLM interpretation constrained by the real transcript.

### Heuristic pre-compute (deterministic)

Before the LLM runs, `computeHeuristicSignals()` derives from stored turns:

- Filler-word count, avg response length
- Dead-air flags (latency-adjusted — normal STT→LLM→TTS gaps are excluded)
- Escalation keyword flags
- Greeting/introduction detection for rubric hints

Code: `my-livekit-agent/src/analysis/heuristics.ts`

### LLM constrained by transcript + hints

The analysis user prompt embeds the **full transcript** and heuristic hints. The system prompt requires:

- Every rubric `evidence` field must quote or closely paraphrase a specific transcript line
- Dead-air scoring uses **only** the provided heuristic flags — "do not invent dead air from raw timestamps"
- `improvement_areas` must have real transcript evidence

Code: `my-livekit-agent/src/prompts/callAnalysis.v1.ts`

### Post-LLM normalization (schema + sanity checks)

`normalizeAnalysisPayload()` clamps rubric scores to 0–20, derives `rubric_score` from item scores (not the model's headline number), falls back sentiment/call-flow to turn data when the LLM returns garbage, and merges heuristic flags the model cannot override.

Code: `my-livekit-agent/src/analysis/normalize.ts`

### Dashboard verification

On each call detail page, rubric evidence, transcript turns, and inline annotations are shown **side by side** so a reviewer can spot-check every AI claim against the source turns.

---

## 4. README (not just `npm install && npm start`)

Root `README.md` documents:

- Architecture diagram (WebRTC → STT → LLM → TTS)
- Prerequisites, env setup, how to talk to the agent via LiveKit Playground
- Step 1 checklist (transport, providers, persona, interruptions, latency)
- Step 3 analysis pipeline + scorecard JSON shape
- Loop 2 prompt evolution commands
- Step 4 dashboard setup
- MongoDB document shape, recording pipeline, manual CLI tools

Additional docs:

- `dashboard/README.md` — API endpoints, demo seed, project structure
- `latency.md` — latency measurement notes

---

## 5. Error handling (graceful degradation)

The agent and pipelines fail safely instead of crashing on unusual input.

| Area | Behavior |
|---|---|
| **Invalid account digits** | `normalizeLastFour()` returns structured JSON with `invalidInput` + a spoken-friendly message — agent asks again instead of throwing |
| **Billing DB miss** | Returns `found: false` with guidance text, not an exception |
| **Tool / DB errors** | Caught, logged, agent prompt instructs: apologize once, offer callback within 24h |
| **Call recording** | Best-effort — transcode/storage failure logs and sets `recording.status: "failed"`; call still completes |
| **Post-call analysis** | Sets `analysisStatus: "failed"` with error message; worker continues |
| **Prompt evolution** | Sets `promptEvolutionStatus: "failed"`; prior active prompt unchanged |
| **MongoDB writes** | Turn append / finalize wrapped in `.catch()` — logging only, no session crash |
| **Agent session crash** | `recorder.fail()` marks conversation failed before re-throwing |
| **Dashboard API** | UI shows connection errors with setup instructions instead of a blank screen |

Representative code paths:

- `my-livekit-agent/src/tools/billing.ts` — digit validation + try/catch on lookups
- `my-livekit-agent/src/services/callRecorder.ts` — best-effort recording
- `my-livekit-agent/src/services/callAnalysisService.ts` — analysis status on failure
- `my-livekit-agent/src/services/promptEvolution/index.ts` — evolution status on failure
- `dashboard/src/pages/DashboardPage.tsx` — API error state with recovery hints

---

## Quick start (end-to-end)

```bash
# Terminal 1 — voice agent
cd my-livekit-agent
cp .env.example .env   # LIVEKIT_*, DEEPGRAM_*, MONGODB_URI
npm install
npm run dev

# Terminal 2 — QA dashboard
cd dashboard
cp .env.example .env
npm install
npm run dev

# Talk to Alex
# → https://agents-playground.livekit.io (same LiveKit creds as .env)

# After a call, review in dashboard or re-run analysis manually:
cd my-livekit-agent
npm run analyze:call -- <callId>
```

---

## Project map

```
VoiceAgent/
├── README.md                          # Full setup + architecture
├── Deliverables.md                    # This file
├── dashboard/                         # Step 4 — QA report UI + Express API
└── my-livekit-agent/
    ├── src/prompts/                   # Submitted prompts (agent, analysis, evolution)
    ├── src/analysis/                  # Heuristics + LLM analyzer + normalization
    ├── src/services/
    │   ├── midCallCorrection/         # Loop 1 — live self-healing
    │   └── promptEvolution/           # Loop 2 — post-call prompt patching
    ├── src/tools/billing.ts           # Billing lookups with input validation
    └── src/agent.ts                   # Worker entrypoint
```
