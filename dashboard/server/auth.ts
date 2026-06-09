import type { NextFunction, Request, Response } from 'express';

const API_KEY = process.env.DASHBOARD_API_KEY?.trim();

function extractApiKey(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  const xApiKey = req.header('x-api-key');
  if (xApiKey) {
    return xApiKey.trim();
  }

  const queryKey = req.query.apiKey;
  if (typeof queryKey === 'string' && queryKey.length > 0) {
    return queryKey;
  }

  return undefined;
}

export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next();
    return;
  }

  const provided = extractApiKey(req);
  if (provided !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

export function dashboardAuthEnabled(): boolean {
  return Boolean(API_KEY);
}
