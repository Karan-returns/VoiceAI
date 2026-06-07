import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { GridFSBucket, MongoClient, ObjectId, type Db } from 'mongodb';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3456);
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/novatel';
const RECORDINGS_BUCKET = 'recordings';

let db: Db;

async function connect(): Promise<Db> {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const dbName = new URL(MONGODB_URI).pathname.replace(/^\//, '') || 'novatel';
  return client.db(dbName);
}

function serializeRecording(doc: Record<string, unknown> | undefined) {
  if (!doc) {
    return undefined;
  }

  return {
    status: doc.status,
    format: doc.format,
    filename: doc.filename,
    gridFsId: doc.gridFsId,
    sizeBytes: doc.sizeBytes,
    error: doc.error,
  };
}

function serializeCall(doc: Record<string, unknown>) {
  const analysis = doc.analysis as Record<string, unknown> | undefined;
  const turns = (doc.turns as unknown[]) ?? [];
  const startedAt = doc.startedAt as Date;
  const endedAt = doc.endedAt as Date | undefined;
  const recording = serializeRecording(doc.recording as Record<string, unknown> | undefined);

  return {
    callId: doc.callId,
    roomName: doc.roomName,
    startedAt: startedAt?.toISOString?.() ?? startedAt,
    endedAt: endedAt?.toISOString?.() ?? endedAt,
    durationMs:
      startedAt && endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : undefined,
    status: doc.status,
    analysisStatus: doc.analysisStatus,
    rubricScore: analysis?.rubric_score as number | undefined,
    sentimentTrend: analysis?.sentiment_trend as string | undefined,
    flagCount: (analysis?.flags as string[] | undefined)?.length,
    turnCount: turns.length,
    recording,
  };
}

function serializeDetail(doc: Record<string, unknown>) {
  const base = serializeCall(doc);
  const turns = ((doc.turns as Array<Record<string, unknown>>) ?? []).map((t) => ({
    role: t.role,
    content: t.content,
    timestamp: (t.timestamp as Date)?.toISOString?.() ?? t.timestamp,
    interrupted: t.interrupted,
  }));
  const corrections = ((doc.corrections as Array<Record<string, unknown>>) ?? []).map((c) => ({
    signal: c.signal,
    blockId: c.blockId,
    evidence: c.evidence,
    injectedAt: (c.injectedAt as Date)?.toISOString?.() ?? c.injectedAt,
    latencyMs: c.latencyMs,
    turnIndex: c.turnIndex,
  }));

  return {
    ...base,
    promptVersion: doc.promptVersion,
    turns,
    corrections: corrections.length ? corrections : undefined,
    analysis: doc.analysis,
    analysisError: doc.analysisError,
    recording: base.recording,
  };
}

function recordingsBucket(): GridFSBucket {
  return new GridFSBucket(db, { bucketName: RECORDINGS_BUCKET });
}

async function main() {
  db = await connect();
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/calls', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 100);
      const offset = Number(req.query.offset ?? 0);
      const hasAnalysis = req.query.analyzed === 'true';

      const filter: Record<string, unknown> = { status: 'completed' };
      if (hasAnalysis) {
        filter.analysisStatus = 'completed';
      }

      const collection = db.collection('conversations');
      const [docs, total] = await Promise.all([
        collection.find(filter).sort({ endedAt: -1 }).skip(offset).limit(limit).toArray(),
        collection.countDocuments(filter),
      ]);

      res.json({ calls: docs.map(serializeCall), total });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/calls/:callId', async (req, res) => {
    try {
      const doc = await db.collection('conversations').findOne({ callId: req.params.callId });
      if (!doc) {
        res.status(404).json({ error: 'Call not found' });
        return;
      }
      res.json(serializeDetail(doc));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/calls/:callId/recording', async (req, res) => {
    try {
      const { callId } = req.params;
      const gfs = recordingsBucket();
      const files = await gfs.find({ filename: `${callId}.mp3` }).limit(1).toArray();

      if (files.length === 0) {
        res.status(404).json({ error: 'Recording not present' });
        return;
      }

      const file = files[0]!;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `inline; filename="${callId}.mp3"`);
      if (file.length) {
        res.setHeader('Content-Length', String(file.length));
      }

      const stream = gfs.openDownloadStream(file._id as ObjectId);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream recording' });
        }
      });
      stream.pipe(res);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/trends', async (_req, res) => {
    try {
      const docs = await db
        .collection('conversations')
        .find({ status: 'completed', analysisStatus: 'completed', analysis: { $exists: true } })
        .sort({ endedAt: 1 })
        .project({ callId: 1, startedAt: 1, endedAt: 1, analysis: 1 })
        .toArray();

      const trends = docs.map((doc) => {
        const analysis = doc.analysis as {
          rubric_score: number;
          sentiment_trend: string;
          flags: string[];
          rubric: Array<{ passed: boolean }>;
        };
        return {
          callId: doc.callId,
          startedAt: (doc.startedAt as Date).toISOString(),
          endedAt: doc.endedAt ? (doc.endedAt as Date).toISOString() : undefined,
          rubricScore: analysis.rubric_score,
          sentimentTrend: analysis.sentiment_trend,
          flagCount: analysis.flags.length,
          rubricPassed: analysis.rubric.filter((r) => r.passed).length,
          rubricTotal: analysis.rubric.length,
        };
      });

      res.json({ trends });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.listen(PORT, () => {
    console.log(`QA Dashboard API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
