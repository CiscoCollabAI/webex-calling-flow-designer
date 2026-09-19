/**
 * Dev-only capture of raw Webex API responses, for verifying field names/shapes
 * against live data instead of guessing. Disabled by default — enable by loading
 * the app with ?debugApi=1 once (persists via localStorage until ?debugApi=0).
 */

export interface ApiCaptureEntry {
  id: string;
  path: string;
  timestamp: number;
  body: unknown;
}

const STORAGE_KEY = 'webexDebugApiCapture';
const MAX_ENTRIES = 50;

let entries: ApiCaptureEntry[] = [];
let seq = 0;
const listeners = new Set<() => void>();

export function isDebugCaptureEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('debugApi') === '1') {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } else if (params.get('debugApi') === '0') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function recordApiResponse(path: string, body: unknown): void {
  if (!isDebugCaptureEnabled()) return;
  entries = [{ id: `capture-${++seq}`, path, timestamp: Date.now(), body }, ...entries].slice(0, MAX_ENTRIES);
  listeners.forEach((l) => l());
}

export function getApiCaptures(): ApiCaptureEntry[] {
  return entries;
}

export function clearApiCaptures(): void {
  entries = [];
  listeners.forEach((l) => l());
}

export function subscribeApiCaptures(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
