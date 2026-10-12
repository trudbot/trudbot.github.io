// Per-level personal bests, kept in localStorage until there is a server leaderboard.
const KEY = "net:v1:records";

export interface Clear {
  /** Milliseconds from revealing the board to the winning turn. */
  timeMs: number;
  /** Clockwise turns made; locking is free. */
  steps: number;
}

/** Time and steps are ranked separately, so each best may come from a different run. */
export interface Best {
  timeMs: number;
  steps: number;
  clears: number;
}

export type Records = Record<number, Best>;

export function loadRecords(): Records {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Records) : {};
  } catch {
    return {};
  }
}

export function saveClear(records: Records, level: number, run: Clear): Records {
  const prev = records[level];
  const next: Records = {
    ...records,
    [level]: prev
      ? {
          timeMs: Math.min(prev.timeMs, run.timeMs),
          steps: Math.min(prev.steps, run.steps),
          clears: prev.clears + 1,
        }
      : { ...run, clears: 1 },
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: the run still counts for this session.
  }
  return next;
}

export function formatTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const s = Math.floor(tenths / 10);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${tenths % 10}`;
}
