const STORAGE_KEY = 'novatel_dashboard_api_key';

export function getApiKey(): string | undefined {
  const baked = import.meta.env.VITE_DASHBOARD_API_KEY as string | undefined;
  if (baked) {
    return baked;
  }
  return sessionStorage.getItem(STORAGE_KEY) ?? undefined;
}

export function setApiKey(key: string): void {
  sessionStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearApiKey(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
