import {
  createPageCanvas,
  nextFrame,
  paintViewport,
  preloadCapture,
  type Viewport,
} from "./capture";
import { buildPieces, createStage, runFall, startCracks, type ShatterTiming } from "./engine";
import { buildFracture, type Point } from "./fracture";

export interface ShatterOptions {
  /** Impact point in viewport (client) px; defaults to the viewport center */
  origin?: { x: number; y: number };
  /** How long the crack web takes to spread out (ms) */
  spreadMs?: number;
  /** How long the cracked pane keeps creaking before it gives way (ms) */
  holdMs?: number;
  /** Downward acceleration of the shards (px/s²) */
  gravity?: number;
}

const DEFAULTS = { spreadMs: 1500, holdMs: 1000, gravity: 2600 };
const FADE_BACK_MS = 450;

let running = false;

/**
 * Cracks the visible page like a pane of glass and then lets it fall apart. Resolves once the
 * page is fully restored. Concurrent calls while an effect is playing are ignored.
 */
export async function triggerShatter(options: ShatterOptions = {}): Promise<void> {
  if (running || typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  running = true;

  // Layout viewport in client px: what `position: fixed; left: 0; top: 0` covers. clientWidth
  // leaves the scrollbar alone so it stays visible and nothing reflows.
  const vp: Viewport = {
    left: 0,
    top: 0,
    width: document.documentElement.clientWidth || window.innerWidth,
    height: window.innerHeight,
  };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const origin: Point = options.origin
    ? [options.origin.x - vp.left, options.origin.y - vp.top]
    : [vp.width / 2, vp.height / 2];
  const spreadMs = options.spreadMs ?? DEFAULTS.spreadMs;
  const holdMs = options.holdMs ?? DEFAULTS.holdMs;
  const timing: ShatterTiming = { gravity: options.gravity ?? DEFAULTS.gravity, release: 0.35 };

  const controller = new AbortController();
  const stage = createStage(vp.width, vp.height, dpr);
  const releaseScroll = lockScroll(stage.root);

  try {
    void preloadCapture();
    const fracture = buildFracture({
      width: vp.width,
      height: vp.height,
      origin,
      spreadMs,
      holdMs,
    });
    const cracks = startCracks(stage, fracture, origin, spreadMs + holdMs, controller.signal);

    // Capturing blocks the main thread for a while on slow phones. Doing it once the web has
    // spread keeps the fast part of the animation smooth; during the hold only a few hairlines
    // move, so a hitch there reads as the glass straining. Scroll is locked, so the page under
    // the cracks is still the one that was hit. A slow capture simply lengthens the hold.
    const page = createPageCanvas(vp, dpr);
    await delay(spreadMs);
    await Promise.all([paintViewport(page, vp, dpr), cracks.finished]);

    const pieces = buildPieces(
      stage,
      page,
      cracks.canvas,
      fracture.shards,
      origin,
      timing,
      Math.random,
    );
    // Behind the falling glass there is nothing left of the page.
    stage.root.style.background = getComputedStyle(document.body).backgroundColor || "#fff";
    cracks.canvas.remove();
    await runFall(
      stage,
      pieces,
      origin,
      fracture.coreRadius,
      timing,
      Math.random,
      controller.signal,
    );

    stage.root.style.transition = `opacity ${FADE_BACK_MS}ms ease-out`;
    stage.root.style.opacity = "0";
    await delay(FADE_BACK_MS);
  } catch (error) {
    console.warn("[glass-shatter]", error);
  } finally {
    controller.abort();
    releaseScroll();
    stage.root.remove();
    await nextFrame();
    running = false;
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const SCROLL_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/**
 * The shards are cut from a snapshot of the viewport, so the page must not scroll underneath.
 * Blocks scroll input instead of toggling `overflow: hidden`, which would remove the scrollbar,
 * reflow the page and misalign it with the snapshot.
 */
function lockScroll(stage: HTMLElement) {
  const block = (e: Event) => e.preventDefault();
  const blockKeys = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key)) e.preventDefault();
  };
  const opts = { passive: false } as const;
  window.addEventListener("wheel", block, opts);
  window.addEventListener("touchmove", block, opts);
  window.addEventListener("keydown", blockKeys, opts);
  stage.addEventListener("pointerdown", block, opts);
  return () => {
    window.removeEventListener("wheel", block);
    window.removeEventListener("touchmove", block);
    window.removeEventListener("keydown", blockKeys);
    stage.removeEventListener("pointerdown", block);
  };
}
