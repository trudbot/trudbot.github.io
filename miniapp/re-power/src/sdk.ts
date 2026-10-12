import hbSDK, { HbMiniProgramSDKError } from "@heybox/hb-sdk";

export { hbSDK };

/**
 * Resolves true once the Host handshake succeeds, false if it fails (e.g. the
 * page is opened in a plain browser). The `ready` event does not replay, so
 * this goes through the persistent handshake state instead.
 */
export const sdkReady: Promise<boolean> = new Promise((resolve) => {
  const stop = hbSDK.onHandshakeStateChange((state) => {
    if (state.status === "connecting") return;
    resolve(state.status === "ready");
    // The handler can run synchronously during subscription, before `stop` exists.
    queueMicrotask(() => stop());
  });
});

export function errorCode(error: unknown): string | undefined {
  return error instanceof HbMiniProgramSDKError ? error.code : undefined;
}

export function isRateLimited(error: unknown): boolean {
  const code = errorCode(error);
  return code === "RATE_LIMITED" || code === "RATE_LIMITED_BY_RUNTIME";
}

/** Suggested back-off for a rate-limited call; the platform may omit it. */
export function retryAfterMs(error: unknown, fallback = 30_000): number {
  if (!(error instanceof HbMiniProgramSDKError)) return fallback;
  const data = error.data as { retryAfterMs?: unknown } | undefined;
  return typeof data?.retryAfterMs === "number" ? data.retryAfterMs : fallback;
}

export function toast(message: string, status?: "success" | "error") {
  hbSDK.ui.showToast(status ? { message, status } : { message }).catch(() => {});
}

export type Intensity = "light" | "medium" | "heavy";

let hapticsOn = true;
export const setHaptics = (on: boolean) => {
  hapticsOn = on;
};

/** Fire-and-forget: desktop Hosts have no haptics and reject with METHOD_FORBIDDEN. */
export function vibrate(intensity: Intensity, delay = 0) {
  if (!hapticsOn) return;
  hbSDK.device.vibrate({ intensity, delay }).catch(() => {});
}
