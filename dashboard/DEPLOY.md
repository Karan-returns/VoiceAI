# Deploying the QA Dashboard

Internal dashboard for reviewing analyzed calls, transcripts, and recordings.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | Same Atlas URI as the agent (`novatel` database) |
| `DASHBOARD_API_KEY` | Prod | Team access key — teammates enter this on the login screen |
| `PORT` | No | Set automatically by Render/Railway/Fly (default `3456`) |
| `DASHBOARD_CORS_ORIGIN` | No | Restrict CORS to your hosted URL |

## Option A — Render.com (recommended, free tier)

1. Push this repo to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**.
3. Connect your repo.
4. Settings:
   - **Root Directory:** `dashboard`
   - **Runtime:** Docker
   - **Health Check Path:** `/api/health`
5. Environment variables:
   - `MONGODB_URI` = your Atlas connection string (single-quoted in Render UI is fine)
   - `DASHBOARD_API_KEY` = generate a long random string (`openssl rand -hex 24`)
6. Click **Deploy**.

When live, share:
- **URL:** `https://your-app.onrender.com`
- **Access key:** the `DASHBOARD_API_KEY` value (not the MongoDB password)

Or use the blueprint: set root to `dashboard` and deploy `render.yaml`.

## Option B — Docker on a VM

```bash
cd dashboard
cp .env.example .env
# Edit .env — set MONGODB_URI and DASHBOARD_API_KEY

bash scripts/deploy.sh
```

Share `http://your-server:3456` + the access key with your team.

## Option C — Local (development)

```bash
cd dashboard
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. Auth is skipped when `DASHBOARD_API_KEY` is unset.

## Sharing with your company

1. Deploy to Render (or your VM) with `DASHBOARD_API_KEY` set.
2. Send teammates:
   - Dashboard URL
   - Access key (one shared key for internal QA is fine; rotate if someone leaves)
3. They open the URL, enter the key once — it’s saved in the browser session.

Do **not** share `MONGODB_URI` or LiveKit API secrets.

## Production build (without Docker)

```bash
npm run build
DASHBOARD_API_KEY=your-key MONGODB_URI='mongodb+srv://...' npm start
```

## Verify

```bash
curl https://your-app.onrender.com/api/health
# {"ok":true,"auth":true}
```
