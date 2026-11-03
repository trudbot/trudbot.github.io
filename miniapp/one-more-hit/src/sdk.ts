import hbSDK from "@heybox/hb-sdk";

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

/**
 * Host insets reach the page through CSS variables. `env()` stays as the
 * fallback for plain browsers, where the SDK cannot measure the window.
 */
export function trackSafeArea() {
  const measure = async () => {
    if (!(await sdkReady)) return;
    try {
      const info = await hbSDK.viewport.getWindowInfo();
      const root = document.documentElement.style;
      root.setProperty("--omh-safe-t", `${info.safeArea.top}px`);
      root.setProperty("--omh-safe-r", `${info.windowWidth - info.safeArea.right}px`);
      root.setProperty("--omh-safe-b", `${info.windowHeight - info.safeArea.bottom}px`);
      root.setProperty("--omh-safe-l", `${info.safeArea.left}px`);
    } catch (error) {
      console.error("无法读取安全区域", error);
    }
  };
  void measure();
  // The page is always dark, so the Host chrome always needs a light foreground.
  void sdkReady.then((ok) => {
    if (ok) hbSDK.viewport.setNavigationBarStyle({ foregroundStyle: "light" }).catch(() => {});
  });
  window.addEventListener("resize", measure);
  hbSDK.on("viewport_change", () => void measure());
}

/**
 * The Host reports backgrounding through its own lifecycle events, which do
 * not always surface as a page visibility change, so both are tracked.
 */
export function onVisibility(cb: (visible: boolean) => void) {
  let hostHidden = false;
  let last = true;
  const emit = () => {
    const v = !hostHidden && document.visibilityState !== "hidden";
    if (v !== last) {
      last = v;
      cb(v);
    }
  };
  hbSDK.on("hide", () => {
    hostHidden = true;
    emit();
  });
  hbSDK.on("show", () => {
    hostHidden = false;
    emit();
  });
  document.addEventListener("visibilitychange", emit);
}
