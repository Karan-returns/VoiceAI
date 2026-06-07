# NovaTel QA Dashboard

Browser-based call quality report dashboard for NovaTel voice agent analysis. Designed for QA managers reviewing post-call scorecards — not raw JSON dumps.

## Features

- **Visual QA scorecard** — rubric items with pass/fail, scores, and evidence
- **Sentiment arc** — line chart tracking customer sentiment across the call timeline
- **Call flow timeline** — stage progression (Greeting → Discovery → Resolution → Escalation → Closing)
- **Flagged moments** — dead air and escalation highlighted inline on the transcript
- **Side-by-side transcript** — original turns paired with AI annotations (sentiment, stage, corrections)
- **Cross-call trends** — score and flag comparison when multiple calls are analyzed

## Prerequisites

- Node.js 22+
- MongoDB running with analyzed conversations (same `MONGODB_URI` as the agent worker)

## Setup

```bash
cd dashboard
cp .env.example .env
npm install
```

### Demo data (optional)

```bash
npm run seed:demo
```

Seeds 3 sample analyzed calls into `novatel.conversations`.

## Run

```bash
npm run dev
```

- **Dashboard UI:** http://localhost:5173
- **API server:** http://localhost:3456

## API endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/calls?analyzed=true` | List completed calls with analysis summary |
| `GET /api/calls/:callId` | Full call detail (turns, corrections, scorecard) |
| `GET /api/trends` | Cross-call trend data for comparison charts |

## Project structure

```
dashboard/
├── server/
│   ├── index.ts       # Express read API
│   └── seedDemo.ts    # Demo data seeder
└── src/
    ├── pages/         # Dashboard list + call detail
    └── components/    # Scorecard, charts, transcript panels
```
