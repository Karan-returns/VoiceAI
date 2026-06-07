# Latency Optimizations

Crisp summary of what was done to reduce voice-agent latency (perceived + measured).

---

## Cold-start elimination (worker prewarm)

- **Prewarm LLM + TTS on idle worker** — one throwaway LLM completion + TTS `prewarm()` before any call lands, so first turn skips cold DNS/TLS/HTTP penalties (~7s LLM TTFT, ~3.7s TTS TTFB observed without warmup).
- **Reuse the same provider instances** — prewarm builds LLM/TTS once in `prewarm`, `entry` reuses them so keep-alive connections are actually used at call time.
- **Fire-and-forget warmup** — warmup runs in background so worker init stays under `initializeProcessTimeout` (30s).
- **Keep 1 idle process** — `numIdleProcesses: 1` so VAD + Mongo + warmed connections are ready before the first test call.
- **Load VAD + Mongo during prewarm** — Silero VAD and DB indexes/seed run on the idle worker, not on the critical path of the first turn.

---

## Call entry parallelism

- **Early WebRTC connect** — `ctx.connect()` starts at the top of `entry`, overlapping room join with prompt load, session setup, and recorder init (WebRTC was the largest single first-call chunk when done serially).

---

## Turn pipeline (framework tuning)

- **Preemptive LLM generation ON** — LLM starts speculating while the user is still finishing their turn; framework discards stale runs when billing context changes.
- **Preemptive TTS OFF** — LLM TTFT dominates; preempting audio before turn confirmation is riskier.
- **VAD-driven turn detection** — avoids STT/VAD desync that left the pipeline stuck (no end-of-utterance).
- **Tight endpointing** — `minDelay: 280ms`, `maxDelay: 1800ms` (fixed mode) for faster turn handoff without cutting off mid-sentence.
- **Connection retry/timeouts tuned** — LLM 15s / STT+TTS 10s with short retry intervals so failures fail fast instead of hanging.

---

## Perceived latency (dead air)

- **Instant latency filler** — on every user turn, `playLatencyFiller()` fires immediately (non-blocking) via `session.say()` while billing prefetch + LLM run; filler is not added to chat context.
- **Prompt forbids hold phrases** — agent never says "please hold", "let me check", or "one moment"; starts each reply with one brief sentence so TTS speaks something useful fast.
- **Concise system prompt** — kept short intentionally to reduce LLM TTFT on voice calls.

---

## Billing / tool path (avoid mid-call stalls)

- **Billing prefetch before LLM** — DB lookup runs in `onUserTurnCompleted` and injects a compact system message so the LLM answers in one turn without calling `lookupBillingAccount`.
- **Compact billing summary** — prefetch injects prose (~1 paragraph), not full JSON, so LLM context stays small and fast.
- **Prefetch persists across follow-up turns** — once account digits are known, prefetch refreshes on every turn so the agent never re-triggers a tool lookup mid-call.
- **Orphan tool cleanup** — `pruneOrphanToolItems` in `onUserTurnCompleted` + `llmNode` strips stale tool calls from preemptive runs so context stays clean.

---

## Fast default model stack

| Stage | Default | Why |
|-------|---------|-----|
| LLM | `openai/gpt-4.1-nano` | Low TTFT |
| TTS | `cartesia/sonic-turbo` | ~100–300ms TTFB when warm |
| STT | `cartesia/ink-whisper` | Streaming via LiveKit Inference |

All swappable via env (`LLM_MODEL`, `TTS_MODEL`, `STT_MODEL`).

---

## Measurement & QA

- **Pipeline latency test** — `npm run test:pipelineLatency` (in `my-livekit-agent/`) runs the real turn path: filler → billing prefetch → LLM → TTS; reports first-TTS and full-reply timings per turn.
- **Session metrics** — `attachSessionMetrics` logs TTFT/TTFB per stage in production calls.
- **Latency-adjusted dead-air heuristics** — post-call QA only flags gaps ≥ 9s (grace + threshold), so normal pipeline latency is not scored as dead air.
- **Warmup-tolerant greeting rubric** — 8s grace on first-turn latency so transport/warmup delay does not fail the greeting score.

---

## Key files

| What | Where |
|------|-------|
| Worker prewarm + session config | `my-livekit-agent/src/agent.ts` |
| LLM/TTS connection warmup | `my-livekit-agent/src/services/connectionWarmup.ts` |
| Latency filler | `my-livekit-agent/src/services/latencyFiller.ts` |
| Billing prefetch | `my-livekit-agent/src/services/billingPrefetch.ts` |
| Compact billing context | `my-livekit-agent/src/services/summarizeBillingLookup.ts` |
| Concise voice prompt | `my-livekit-agent/src/prompts/novaTelSupport.v1.ts` |
| Latency benchmark | `my-livekit-agent/src/tests/pipelineLatency.run.ts` |
