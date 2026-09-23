/**
 * Stable, privacy-light visitor id via FingerprintJS (open-source).
 *
 * The fingerprint is computed client-side (no server, no cookies) and then
 * cached in localStorage so subsequent page loads read it synchronously. Like
 * the rest of analytics, resolution is best-effort: any failure yields
 * `undefined` and never throws or logs, so tracking stays non-blocking.
 *
 * `uid` identifies a browser across sessions; `sid` (in the tracker) still
 * identifies a single page-view session. Events carry whichever is available.
 */

const STORAGE_KEY = "__log_uid";

let cached: string | undefined;
let inflight: Promise<string | undefined> | undefined;

export function getUid(): string | undefined {
  if (cached) return cached;
  if (typeof localStorage === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // localStorage can throw (private mode, blocked storage); treat as absent.
  }
  return undefined;
}

async function resolveUid(): Promise<string | undefined> {
  try {
    const { default: FingerprintJS } = await import("@fingerprintjs/fingerprintjs");
    const agent = await FingerprintJS.load();
    const { visitorId } = await agent.get();
    cached = visitorId;
    try {
      localStorage.setItem(STORAGE_KEY, visitorId);
    } catch {
      // Persistence is an optimisation only; in-memory cache still applies.
    }
    return visitorId;
  } catch {
    // Fingerprinting must never break the page or touch the console.
    return undefined;
  } finally {
    inflight = undefined;
  }
}

/** Resolve the visitor id, loading FingerprintJS on first use. Deduplicated. */
export function ensureUid(): Promise<string | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  const existing = getUid();
  if (existing) return Promise.resolve(existing);
  inflight ??= resolveUid();
  return inflight;
}
