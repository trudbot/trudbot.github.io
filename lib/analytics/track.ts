/**
 * Minimal, dependency-free analytics client.
 *
 * Design contract (see the three requirements this module exists to satisfy):
 *  1. Fire-and-forget: uses `navigator.sendBeacon` so events survive the
 *     click-then-navigate case on outbound links, with a `keepalive` fetch
 *     fallback.
 *  2. Never affects the page: every path is wrapped so a failed, blocked, or
 *     offline endpoint can never throw into caller code, and nothing is ever
 *     written to the console.
 *  3. Small, typed surface: callers use the `trackDisplay` / `trackClick`
 *     helpers and pass a logical event name plus arbitrary custom params.
 */

export type TrackEventType = "display" | "exposure" | "click";

export type TrackParams = Record<string, unknown>;

// Overridable at build time; falls back to the production logging endpoint.
const ENDPOINT =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_LOG_ENDPOINT ?? "https://api.trudbot.cn/log";

function deliver(body: string): void {
  // A plain string body is sent as `text/plain`, a CORS-safelisted content
  // type, so no preflight is required cross-origin. The endpoint parses the
  // JSON payload from the raw body regardless of the declared content type.
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function" &&
    navigator.sendBeacon(ENDPOINT, body)
  ) {
    return;
  }

  // Fallback when sendBeacon is unavailable or refused the payload. `keepalive`
  // lets the request outlive the page; `no-cors` keeps it a simple request and
  // means we neither need nor read a response.
  if (typeof fetch === "function") {
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    }).catch(() => undefined);
  }
}

export function track(
  type: TrackEventType,
  name: string,
  params?: TrackParams,
): void {
  // No-op during SSG/SSR and never let a logging failure reach the caller.
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      type,
      // Client event time is when the interaction happened; the endpoint keeps
      // its own receive time and enriches ip/geo/timezone/language server-side.
      timestamp: Date.now(),
      params: {
        name,
        page: window.location.pathname,
        host: window.location.host,
        ...params,
      },
    });
    deliver(body);
  } catch {
    // Swallow everything: analytics must never break page behaviour, and the
    // console is intentionally left clean.
  }
}

export const trackDisplay = (name: string, params?: TrackParams): void =>
  track("display", name, params);

export const trackExposure = (name: string, params?: TrackParams): void =>
  track("exposure", name, params);

export const trackClick = (name: string, params?: TrackParams): void =>
  track("click", name, params);
