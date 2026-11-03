import type { SceneId } from "./game/config.ts";
import { hbSDK, sdkReady, setHaptics } from "./sdk.ts";

export interface Best {
  stars: number;
  score: number;
  accuracy: number;
}

export interface Settings {
  music: boolean;
  musicVol: number;
  sfx: boolean;
  sfxVol: number;
  haptics: boolean;
}

export interface Save {
  v: 1;
  best: Partial<Record<SceneId, Best>>;
  settings: Settings;
}

const KEY = "omh_save_v1";

const empty = (): Save => ({
  v: 1,
  best: {},
  settings: { music: true, musicVol: 0.8, sfx: true, sfxVol: 0.9, haptics: true },
});

function parse(raw: unknown): Save {
  if (!raw || typeof raw !== "object" || (raw as Save).v !== 1) return empty();
  const s = raw as Save;
  return {
    ...empty(),
    best: typeof s.best === "object" && s.best ? s.best : {},
    settings: { ...empty().settings, ...s.settings },
  };
}

let state: Save = empty();
let loaded = false;
// Outside the Host (plain browser) the platform storage is unavailable.
let useHost = false;
const listeners = new Set<(s: Save) => void>();

export const loadSave: Promise<Save> = (async () => {
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
  return state;
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
  for (const l of listeners) l(state);
  if (loaded) void flush();
}

export const getSave = () => state;

export function onSave(l: (s: Save) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Stores a passing result; returns whether it beat the previous best score. */
export function recordBest(id: SceneId, r: Best): boolean {
  const prev = state.best[id];
  const better = !prev || r.score > prev.score;
  if (prev && !better && r.stars <= prev.stars) return false;
  updateSave((s) => ({
    ...s,
    best: {
      ...s.best,
      [id]: {
        stars: Math.max(prev?.stars ?? 0, r.stars),
        score: Math.max(prev?.score ?? 0, r.score),
        accuracy: Math.max(prev?.accuracy ?? 0, r.accuracy),
      },
    },
  }));
  return better;
}
