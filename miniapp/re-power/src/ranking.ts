import type { LeaderboardEntry } from "@heybox/hb-sdk";
import { useSyncExternalStore } from "react";
import { LEVELS } from "./levels";
import { type Clear, getSave, type SubmitState, updateSave } from "./save";
import { errorCode, hbSDK, isRateLimited, retryAfterMs, sdkReady } from "./sdk";

export type Metric = "time" | "steps";

/**
 * The platform allows only three boards per mini-program, far fewer than one
 * per level and metric. So a single board holds each account's whole set of
 * first clears in its public `extra`, and the per-level rankings are built on
 * the client from the full list. Create it once with
 * `hb-sdk remote cloud leaderboard create clears --order desc --rank-limit 0`
 * (see scripts/create-boards.mjs).
 */
export const BOARD = "clears";

/** Board pages read per refresh; beyond this the per-level rankings are partial. */
const PAGE = 100;
const MAX_PAGES = 20;

/**
 * Orders the board by progress, then by less total first-clear time. Every
 * new first clear raises the level count, so the platform, which only keeps a
 * strictly better score, always accepts the grown set of clears.
 */
const SPAN = 1e10;
const scoreOf = (clears: (Clear | null)[]) => {
  const done = clears.filter((c): c is Clear => c !== null);
  const total = done.reduce((t, c) => t + c.timeMs, 0);
  return done.length * SPAN - Math.min(total, SPAN - 1);
};

/** `extra.c[level]` is `[timeMs, steps]`, or null for a level not cleared. */
function readClears(entry: LeaderboardEntry | undefined | null): (Clear | null)[] {
  const raw = (entry?.extra as { c?: unknown } | undefined)?.c;
  const list = Array.isArray(raw) ? raw : [];
  return LEVELS.map((_, i) => {
    const v = list[i];
    if (!Array.isArray(v)) return null;
    const [timeMs, steps] = v;
    return Number.isSafeInteger(timeMs) && Number.isSafeInteger(steps) && timeMs > 0 && steps >= 0
      ? { timeMs, steps }
      : null;
  });
}

const writeClears = (clears: (Clear | null)[]) => ({
  c: clears.map((c) => (c ? [c.timeMs, c.steps] : null)),
});

export type SyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "unauthorized" }
  | { status: "rate_limited"; until: number }
  | { status: "error"; code?: string }
  | { status: "offline" };

let sync: SyncState = { status: "idle" };
/** The account's board entry as last returned by the platform; `null` means none yet. */
let mine: LeaderboardEntry | null | undefined;
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const l of listeners) l();
}

function set(next: SyncState) {
  sync = next;
  emit();
}

function rememberMine(entry: LeaderboardEntry | null) {
  mine = entry;
  snapshot = null;
  emit();
}

export function useRanking() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return { sync, mine };
}

function fail(error: unknown) {
  if (errorCode(error) === "UNAUTHORIZED") set({ status: "unauthorized" });
  else if (isRateLimited(error)) set({ status: "rate_limited", until: Date.now() + retryAfterMs(error) });
  else set({ status: "error", code: errorCode(error) });
}

let running: Promise<void> | null = null;

/**
 * Brings this device's first clears to the board. Only first clears are ever
 * sent: replays never touch it. A level the board already holds for this
 * account (an earlier first clear, possibly from another device) keeps the
 * board's value, so the earliest first clear is the one that stands.
 */
export function syncFirstClears(): Promise<void> {
  if (sync.status === "rate_limited" && Date.now() < sync.until) return Promise.resolve();
  running ??= run().finally(() => (running = null));
  return running;
}

async function run() {
  if (!(await sdkReady)) {
    set({ status: "offline" });
    return;
  }
  const pending = Object.entries(getSave().levels).filter(([, r]) => r.submit === "pending");
  if (!pending.length) {
    if (sync.status !== "unauthorized") set({ status: "idle" });
    return;
  }

  set({ status: "syncing" });
  try {
    const existing = (await hbSDK.cloud.leaderboard.getCurrentUserEntry({ key: BOARD })) ?? null;
    const held = readClears(existing);
    const local = getSave().levels;
    const merged = held.map((c, i) => c ?? (local[i] ? { timeMs: local[i].first.timeMs, steps: local[i].first.steps } : null));
    const grows = merged.some((c, i) => c && !held[i]);
    const entry = grows
      ? await hbSDK.cloud.leaderboard.submit({ key: BOARD, score: scoreOf(merged), extra: writeClears(merged) })
      : existing;
    rememberMine(entry);

    const stored = readClears(entry);
    updateSave((s) => {
      const levels = { ...s.levels };
      for (const [k, rec] of Object.entries(levels)) {
        const i = Number(k);
        if (rec.submit !== "pending" || !stored[i]) continue;
        const own = held[i] === null || (held[i].timeMs === rec.first.timeMs && held[i].steps === rec.first.steps);
        levels[i] = { ...rec, submit: (own ? "done" : "exists") satisfies SubmitState };
      }
      return { ...s, levels };
    });
    set({ status: "idle" });
  } catch (error) {
    fail(error);
  }
}

export interface Row {
  appUserId: string;
  timeMs: number;
  steps: number;
}

export interface Snapshot {
  /** Every reported first clear per level, unsorted. */
  levels: Row[][];
  /** False when the read stopped at the page cap before the end of the board. */
  complete: boolean;
}

let snapshot: Snapshot | null = null;
let reading: Promise<Snapshot> | null = null;

/**
 * Reads the whole board once and splits it into per-level rows. The result is
 * kept for the session: the platform caches reads for minutes anyway, and
 * paging through the board on every tab switch would only burn the rate limit.
 */
export function readSnapshot(force = false): Promise<Snapshot> {
  if (snapshot && !force) return Promise.resolve(snapshot);
  reading ??= load().finally(() => (reading = null));
  return reading;
}

async function load(): Promise<Snapshot> {
  const entries: LeaderboardEntry[] = [];
  let cursor: string | undefined;
  let complete = false;
  for (let p = 0; p < MAX_PAGES; p++) {
    const page = await hbSDK.cloud.leaderboard.getList({ key: BOARD, limit: PAGE, ...(cursor ? { cursor } : {}) });
    entries.push(...page.entries);
    if (!page.hasMore || !page.cursor) {
      complete = true;
      break;
    }
    cursor = page.cursor;
  }
  // The account's own entry may lie past the page cap; it always counts.
  if (mine && !entries.some((e) => e.appUserId === mine?.appUserId)) entries.push(mine);

  const levels: Row[][] = LEVELS.map(() => []);
  for (const e of entries) {
    readClears(e).forEach((c, i) => {
      if (c) levels[i].push({ appUserId: e.appUserId, ...c });
    });
  }
  snapshot = { levels, complete };
  return snapshot;
}

/** Ties on the ranked metric fall back to the other one. */
export function rankRows(rows: Row[], metric: Metric): Row[] {
  const [a, b] = metric === "time" ? (["timeMs", "steps"] as const) : (["steps", "timeMs"] as const);
  return rows.slice().sort((x, y) => x[a] - y[a] || x[b] - y[b]);
}

/** The account's own entry; `undefined` when signed out or the call failed. */
export async function fetchMine(): Promise<LeaderboardEntry | null | undefined> {
  try {
    const entry = (await hbSDK.cloud.leaderboard.getCurrentUserEntry({ key: BOARD })) ?? null;
    if (mine?.updatedAt !== entry?.updatedAt) rememberMine(entry);
    else mine = entry;
    return entry;
  } catch (error) {
    if (errorCode(error) === "UNAUTHORIZED" && sync.status !== "syncing") set({ status: "unauthorized" });
    return undefined;
  }
}

// appUserId is opaque and only stable inside this mini-program, so it is
// turned into a short call sign rather than shown raw.
const CALL_SIGN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function callSign(appUserId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < appUserId.length; i++) {
    h ^= appUserId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += CALL_SIGN[(h >>> 0) % 32];
    h = Math.floor((h >>> 0) / 32);
  }
  return `幸存者 ${s}`;
}
