import { type ReactNode, useEffect, useState } from 'react';

import { clearApiKey, getApiKey, setApiKey } from '../auth';

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(() => Boolean(getApiKey()));
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body: { auth?: boolean }) => {
        setAuthRequired(Boolean(body.auth));
        if (!body.auth) {
          setUnlocked(true);
        }
      })
      .catch(() => {
        setAuthRequired(false);
        setUnlocked(true);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);

    const key = input.trim();
    if (!key) {
      setError('Enter the access key shared by your team.');
      setChecking(false);
      return;
    }

    try {
      const res = await fetch('/api/calls?limit=1', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        throw new Error('Invalid access key');
      }
      setApiKey(key);
      setUnlocked(true);
    } catch {
      clearApiKey();
      setError('Invalid access key. Ask your admin for the dashboard API key.');
    } finally {
      setChecking(false);
    }
  }

  if (authRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-muted text-sm">
        Loading…
      </div>
    );
  }

  if (!authRequired || unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-surface-raised border border-border-subtle rounded-xl p-8 shadow-xl">
        <h1 className="text-lg font-semibold text-text-primary">NovaTel QA Dashboard</h1>
        <p className="mt-2 text-sm text-text-muted">
          Enter the access key your team admin shared to review call quality reports.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Access key"
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            autoComplete="current-password"
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={checking}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {checking ? 'Verifying…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
