import { useSyncExternalStore } from "react";
import { hbSDK, sdkReady, setHaptics } from "./sdk";

export interface Clear {
  /** Milliseconds the board was on screen, from "合闸" to the winning turn. */
  timeMs: number;
  /** Clockwise turns made; locking is free. */
  steps: number;
}

/**
 * Where a first clear stands on the ranked board. `exists` means the board
 * already held this level for the account (e.g. a first clear made on another
 * device), so this device's first clear was deliberately not submitted.
 */
export type SubmitState = "pending" | "done" | "exists";

export interface LevelRecord {
  /** The only run that is ever ranked. */
  first: Clear & { at: number };
  /** Personal bests over every clear, shown locally and never submitted. */
  best: Clear;
  plays: number;
  submit: SubmitState;
}

/**
 * The attempt in progress on a level that has not been cleared yet. It is
 * persisted and resumed instead of restarted, so the ranked first clear
 * cannot be improved by peeking at the board, quitting and starting over.
 */
export interface ActiveRun {
  level: number;
  turns: number[];
  locked: boolean[];
  steps: number;
  /** Board-visible time banked before the current session. */
  elapsedMs: number;
}

export interface Save {
  v: 1;
  levels: Record<number, LevelRecord>;
  run: ActiveRun | null;
  settings: { sound: boolean; haptics: boolean };
}

const KEY = "save_v1";

const empty = (): Save => ({
  v: 1,
  levels: {},
  run: null,
  settings: { sound: true, haptics: true },
});

function parse(raw: unknown): Save {
  if (!raw || typeof raw !== "object" || (raw as Save).v !== 1) return empty();
  const s = raw as Save;
  return {
    ...empty(),
    levels: typeof s.levels === "object" && s.levels ? s.levels : {},
    run: s.run && Array.isArray(s.run.turns) ? s.run : null,
    settings: { ...empty().settings, ...s.settings },
  };
}

let state: Save = empty();
let loaded = false;
const listeners = new Set<() => void>();
// Outside the Host (plain browser) the platform storage is unavailable.
let useHost = false;

function emit() {
  for (const l of listeners) l();
}

export const loadSave: Promise<void> = (async () => {
  useHost = await sdkReady;
  try {
    if (useHost) {
      const { data } = await hbSDK.storage.getStorage<Save>({ key: KEY });
      state = parse(data);
    } else {
      const raw = localStorage.getItem(KEY);
      state = parse(raw ? JSON.parse(raw) : null);
    }
  } catch (error) {
    console.error("读取存档失败", error);
  }
  loaded = true;
  setHaptics(state.settings.haptics);
  emit();
})();

// Writes are whole-value replacements, so only the newest snapshot matters:
// coalesce bursts and never let an older write land after a newer one.
let writing = false;
let dirty = false;
async function flush() {
  if (writing) {
    dirty = true;
    return;
  }
  writing = true;
  do {
    dirty = false;
    const snapshot = state;
    try {
      if (useHost) await hbSDK.storage.setStorage({ key: KEY, data: snapshot });
      else localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.error("保存存档失败", error);
    }
  } while (dirty);
  writing = false;
}

export function updateSave(fn: (s: Save) => Save) {
  state = fn(state);
  setHaptics(state.settings.haptics);
  emit();
  if (loaded) void flush();
}

export const getSave = () => state;

export function useSave(): Save | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (loaded ? state : null),
  );
}

export const isUnlocked = (s: Save, i: number) => i === 0 || Boolean(s.levels[i - 1]);

/** Records a clear; only the first one becomes the ranked run. Returns whether it was the first. */
export function recordClear(level: number, clear: Clear): boolean {
  let first = false;
  updateSave((s) => {
    const prev = s.levels[level];
    first = !prev;
    const next: LevelRecord = prev
      ? {
          ...prev,
          plays: prev.plays + 1,
          best: {
            timeMs: Math.min(prev.best.timeMs, clear.timeMs),
            steps: Math.min(prev.best.steps, clear.steps),
          },
        }
      : {
          first: { ...clear, at: Date.now() },
          best: clear,
          plays: 1,
          submit: "pending",
        };
    return {
      ...s,
      levels: { ...s.levels, [level]: next },
      run: s.run?.level === level ? null : s.run,
    };
  });
  return first;
}

export function formatTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const m = Math.floor(tenths / 600);
  const sec = Math.floor((tenths % 600) / 10);
  return `${m}:${String(sec).padStart(2, "0")}.${tenths % 10}`;
}
