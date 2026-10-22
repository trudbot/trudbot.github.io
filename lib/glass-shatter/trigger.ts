// 隐藏触发：在页面上连续快速点击会给「玻璃」积攒压力，停手后压力回落；积满即从最后一次
// 点击处碎裂。每次点击都会在点击处留下一道小裂纹并很快淡去，让人意识到「点这里会有事发生」；
// 压力越高裂纹越大、停留越久，暗示再点下去会出事。
//
// 本模块会进首屏 chunk，所以只做事件监听和几笔 canvas 描边；特效本体在压力过半时才预加载。

/** Elements whose clicks do something real; counting them would punish normal use. */
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, [role=button], [contenteditable]";
/** Ancestors carrying this attribute weigh more, e.g. the avatar that already invites clicking. */
const WEIGHT_ATTR = "data-shatter-weight";

const TRIGGER_AT = 12;
/** From here on the full effect is likely, so its chunk starts loading. */
const PRELOAD_AT = 5;
const TREMBLE_AT = 9;
/** Clicks spaced closer than this keep all pressure; longer pauses start bleeding it off. */
const GRACE_MS = 600;
const DECAY_PER_S = 2;
/** A press that travels farther than this is a drag or text selection, not a tap. */
const TAP_SLOP_PX = 12;

export function installShatterTrigger(): () => void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return () => {};

  let pressure = 0;
  let lastAt = 0;
  let fired = false;
  const downs = new Map<number, [number, number]>();
  const hints = new Set<HTMLCanvasElement>();

  const decayed = (now: number) => {
    const idle = now - lastAt - GRACE_MS;
    return idle > 0 ? Math.max(0, pressure - (idle / 1000) * DECAY_PER_S) : pressure;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.isPrimary && e.button === 0) downs.set(e.pointerId, [e.clientX, e.clientY]);
  };

  // Rapid clicking on text would otherwise select words and paragraphs, which looks broken.
  // Only kicks in once the visitor is clearly hammering, so ordinary double-click still selects.
  const onMouseDown = (e: MouseEvent) => {
    if (!fired && e.detail >= 2 && decayed(performance.now()) >= 3) e.preventDefault();
  };

  const onPointerUp = (e: PointerEvent) => {
    const down = downs.get(e.pointerId);
    downs.delete(e.pointerId);
    if (fired || !down) return;
    if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > TAP_SLOP_PX) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest(INTERACTIVE)) return;

    const now = performance.now();
    const weight = Number(target?.closest(`[${WEIGHT_ATTR}]`)?.getAttribute(WEIGHT_ATTR)) || 1;
    pressure = decayed(now) + weight;
    lastAt = now;

    const origin = { x: e.clientX, y: e.clientY };
    if (pressure >= TRIGGER_AT) {
      fired = true;
      for (const hint of hints) hint.remove();
      hints.clear();
      import("./index").then((mod) => mod.triggerShatter({ origin }));
      return;
    }
    if (pressure >= PRELOAD_AT) void import("./index");
    const hint = showHint(origin, pressure);
    hints.add(hint);
    hint.addEventListener("hint-done", () => hints.delete(hint), { once: true });
  };

  const onPointerCancel = (e: PointerEvent) => downs.delete(e.pointerId);

  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerCancel, { passive: true });
  window.addEventListener("mousedown", onMouseDown);
  return () => {
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("mousedown", onMouseDown);
    for (const hint of hints) hint.remove();
  };
}

/**
 * A small crack star at the click point; it grows and lingers longer as pressure rises. At low
 * pressure it must stay tiny and brief, since every ordinary click on the page shows one.
 */
function showHint(origin: { x: number; y: number }, pressure: number): HTMLCanvasElement {
  const level = Math.min(1, Math.max(0, (pressure - 1) / (TRIGGER_AT - 1)));
  const radius = 8 + level * 52;
  const size = Math.ceil(radius * 2 + 8);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.setAttribute("aria-hidden", "true");
  // Under <html>, not <body>: the shatter snapshot captures the body and must not include hints.
  canvas.style.cssText = [
    "position:fixed",
    `left:${origin.x - size / 2}px`,
    `top:${origin.y - size / 2}px`,
    `width:${size}px`,
    `height:${size}px`,
    "z-index:2147483646",
    "pointer-events:none",
  ].join(";");

  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const path = new Path2D();
  const rays = 3 + Math.round(level * 5);
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < rays; i++) {
    let a = base + (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const len = radius * (0.45 + Math.random() * 0.55);
    let x = 0;
    let y = 0;
    path.moveTo(x, y);
    for (let s = 0, steps = 3 + Math.round(level * 2); s < steps; s++) {
      a += (Math.random() - 0.5) * 0.5;
      x += (Math.cos(a) * len) / steps;
      y += (Math.sin(a) * len) / steps;
      path.lineTo(x, y);
    }
  }
  // Same three-pass look as the full effect so the hint reads as the start of the same crack.
  ctx.save();
  ctx.translate(0.6, 0.8);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = "rgba(10, 14, 30, 0.38)";
  ctx.stroke(path);
  ctx.restore();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(190, 222, 255, 0.45)";
  ctx.stroke(path);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.stroke(path);

  document.documentElement.appendChild(canvas);

  if (pressure >= TREMBLE_AT) {
    canvas.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-1.5px, 1px)" },
        { transform: "translate(1.5px, -1px)" },
        { transform: "translate(-1px, -1px)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: 180, iterations: 2 },
    );
  }
  const fade = canvas.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 500,
    delay: 350 + level * 2150,
    fill: "forwards",
  });
  fade.onfinish = () => {
    canvas.remove();
    canvas.dispatchEvent(new Event("hint-done"));
  };
  return canvas;
}
