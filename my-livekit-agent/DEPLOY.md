# Deploying to LiveKit Cloud

## Prerequisites

- [LiveKit CLI](https://docs.livekit.io/home/cli/) (`lk`) installed and authenticated
- MongoDB Atlas cluster (required for conversations, analysis, recordings) — see **[ATLAS_SETUP.md](./ATLAS_SETUP.md)**
- LiveKit Cloud project with Inference enabled

## 1. One-time setup

```bash
cd my-livekit-agent
lk cloud auth
```

Create a secrets file (never commit this):

```bash
# .env.secrets — inject into LiveKit Cloud agent
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
MONGODB_URI=mongodb+srv://...
DEEPGRAM_API_KEY=...          # only if STT/TTS_PROVIDER=deepgram

# Production feature flags
RECORDING_ENABLED=true
CALL_ANALYSIS_ENABLED=true
PROMPT_EVOLUTION_ENABLED=false
SEED_BILLING=false
SEED_PROMPT=false
DATA_RETENTION_DAYS=90
NUM_IDLE_PROCESSES=1
NODE_ENV=production
```

Seed billing data once (not on every worker start):

```bash
npm run seed:billing
```

Create and deploy the agent:

```bash
lk agent create --secrets-file .env.secrets
lk agent deploy
```

Subsequent deploys:

```bash
lk agent deploy
```

## 2. Verify

```bash
lk agent status
lk agent logs
```

Test a call via [Agents Playground](https://agents-playground.livekit.io) or your own client.

## 3. Observability

- **Logs:** `lk agent logs` or configure [log drains](https://docs.livekit.io/deploy/agents/logs/) in LiveKit Cloud
- **Alerts:** monitor agent job failures in LiveKit Cloud dashboard
- **MongoDB:** alert on `analysisStatus: "failed"` spikes

## 4. Prompt evolution in production

Keep `PROMPT_EVOLUTION_ENABLED=false` until you have a QA review process. Run evolution manually:

```bash
npm run evolve:prompt -- <callId>
npm run evolve:prompt -- show
npm run evolve:prompt -- rollback v2
```

## 5. Data retention

Set `DATA_RETENTION_DAYS=90` to auto-expire completed conversations via MongoDB TTL index.

Schedule orphaned recording cleanup (TTL does not remove GridFS files):

```bash
npm run purge:recordings
```

## 6. QA Dashboard

Deploy separately — see `dashboard/DEPLOY.md`.
