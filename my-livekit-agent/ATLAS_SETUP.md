# MongoDB Atlas setup for NovaTel Voice Agent

LiveKit Cloud workers run on the internet — they cannot reach `mongodb://127.0.0.1`. Use Atlas so the agent, dashboard, and your laptop all share one database.

## 1. Create a free cluster

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and sign in (or create an account).
2. **Create** → **Deployment** → **M0 Free** (Shared).
3. Provider/region: pick one close to your LiveKit Cloud region (e.g. `us-east-1`).
4. Cluster name: e.g. `novatel-dev`.
5. Click **Create Deployment**.

## 2. Create a database user

Atlas will prompt for a database user during setup (or go to **Database Access** → **Add New Database User**):

| Field | Example |
|-------|---------|
| Authentication | Password |
| Username | `novatel` |
| Password | Generate a strong password (save it) |
| Privileges | **Atlas admin** (dev) or **Read and write to any database** |

## 3. Network access (required for LiveKit Cloud)

**Network Access** → **Add IP Address**:

- For development: **Allow Access from Anywhere** (`0.0.0.0/0`)
- For production: restrict to known IPs when possible; LiveKit Cloud egress IPs vary by region — check [LiveKit docs](https://docs.livekit.io/) or use `0.0.0.0/0` initially and tighten later.

Click **Confirm**.

## 4. Get your connection string

1. **Database** → **Connect** → **Drivers**.
2. Driver: **Node.js**, version 6.7 or later.
3. Copy the connection string. It looks like:

```
mongodb+srv://novatel:<password>@novatel-dev.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

4. **Set the database name** by appending `/novatel` before the `?`:

```
mongodb+srv://novatel:<password>@novatel-dev.xxxxx.mongodb.net/novatel?retryWrites=true&w=majority
```

Replace `<password>` with your real password. If the password contains special characters (`@`, `#`, `:`, etc.), [URL-encode](https://www.urlencoder.org/) them.

## 5. Update your project

Edit `my-livekit-agent/.env`:

```env
MONGODB_URI=mongodb+srv://novatel:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/novatel?retryWrites=true&w=majority
DATA_RETENTION_DAYS=90
```

Edit `dashboard/.env` with the **same** `MONGODB_URI`.

## 6. Verify connection and create indexes

```bash
cd my-livekit-agent
npm run atlas:verify
```

This connects, creates indexes, and seeds the default agent prompt if missing.

## 7. Seed billing test accounts

```bash
npm run seed:billing
```

You should see a count of inserted/updated accounts. Billing lookup during calls uses last-four digits from this seed data.

## 8. Refresh LiveKit secrets and deploy

```bash
bash scripts/prepareSecrets.sh
bash scripts/deploy.sh
```

## Collections created automatically

| Collection | Purpose |
|------------|---------|
| `conversations` | Call transcripts, analysis, recording metadata |
| `billing_accounts` | Demo billing data for tool lookups |
| `agent_prompts` | Versioned system prompts |
| `recordings.files` / `recordings.chunks` | GridFS MP3 storage |

## Browse data in Compass

1. Open [MongoDB Compass](https://www.mongodb.com/products/compass).
2. Paste the same `MONGODB_URI`.
3. Database: `novatel`.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `MongoServerSelectionError` / timeout | Check **Network Access** allows your IP (and `0.0.0.0/0` for LiveKit). |
| `Authentication failed` | Wrong username/password; URL-encode special chars in password. |
| `bad auth : authentication failed` | User not created on the correct cluster. |
| Agent connects but no data | `MONGODB_URI` missing from LiveKit secrets — re-run `prepareSecrets.sh` and `lk agent deploy`. |
| Recordings missing | `RECORDING_ENABLED=true` and `MONGODB_URI` set in cloud secrets. |

## Security notes (internal QA)

- M0 free tier is fine for development and light internal QA.
- Use a dedicated Atlas user with read/write only (not Atlas admin) for production.
- Enable Atlas **backup** on paid tiers before going live with real data.
