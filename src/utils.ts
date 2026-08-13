// ─── Storage helpers (localStorage) ─────────────────────────────────────────
// Replaces the custom window.storage API with standard localStorage calls.

const PREFIX = 'noteit:';

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      // quota exceeded — silently ignore
    }
  },
  delete(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
  },
};

// ─── ID generator ────────────────────────────────────────────────────────────
export const genId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ─── Time formatter ──────────────────────────────────────────────────────────
export const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const sameDay = d.toDateString() === now.toDateString();

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
