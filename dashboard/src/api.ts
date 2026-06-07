import type { CallDetail, CallSummary, TrendPoint } from './types';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchCalls(analyzed = true): Promise<{ calls: CallSummary[]; total: number }> {
  const params = analyzed ? '?analyzed=true' : '';
  return fetchJson(`/api/calls${params}`);
}

export function fetchCall(callId: string): Promise<CallDetail> {
  return fetchJson(`/api/calls/${encodeURIComponent(callId)}`);
}

export function fetchTrends(): Promise<{ trends: TrendPoint[] }> {
  return fetchJson('/api/trends');
}

export function recordingUrl(callId: string): string {
  return `/api/calls/${encodeURIComponent(callId)}/recording`;
}
