// 特效渲染：裂纹覆盖在实时页面上逐步蔓延；随后用视口位图切出的碎片（每片一个 2D canvas，
// 以 CSS 3D transform 合成）整体下坠。帧循环只改 transform，不触发布局；物理按真实 dt 积分。

import { crackProgress, type Crack, type Fracture, type Point, type Shard } from "./fracture";
import { OVERLAY_ATTR } from "./capture";

export interface Stage {
  root: HTMLElement;
  width: number;
  height: number;
  dpr: number;
}

const CRACK_STYLE: Record<Crack["kind"], { shadow: number; halo: number; core: number }> = {
  crush: { shadow: 1.6, halo: 2.4, core: 0.9 },
  radial: { shadow: 2.4, halo: 3.2, core: 1.1 },
  ring: { shadow: 1.8, halo: 2.4, core: 0.8 },
  hairline: { shadow: 1.2, halo: 1.6, core: 0.55 },
};

/**
 * Glass cracks read as a bright core with a dark refraction edge; the dark pass keeps them visible
 * on the light theme and the white pass on the dark theme. Avoids shadowBlur, which is the
 * single most expensive canvas operation on mobile GPUs.
 */
function strokeCracks(ctx: CanvasRenderingContext2D, cracks: Crack[], t: number) {
  const byKind = new Map<Crack["kind"], Path2D>();
  for (const crack of cracks) {
    const p = crackProgress(crack, t);
    if (p <= 0) continue;
    let path = byKind.get(crack.kind);
    if (!path) byKind.set(crack.kind, (path = new Path2D()));
    tracePartial(path, crack.points, p);
  }
  for (const [kind, path] of byKind) {
    const style = CRACK_STYLE[kind];
    ctx.save();
    ctx.translate(0.6, 0.8);
    ctx.lineWidth = style.shadow;
    ctx.strokeStyle = "rgba(10, 14, 30, 0.38)";
    ctx.stroke(path);
    ctx.restore();
    ctx.lineWidth = style.halo;
    ctx.strokeStyle = "rgba(190, 222, 255, 0.45)";
    ctx.stroke(path);
    ctx.lineWidth = style.core;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.stroke(path);
  }
}

function tracePartial(path: Path2D, points: Point[], progress: number) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  let remaining = total * progress;
  path.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length && remaining > 0; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len <= remaining) {
      path.lineTo(bx, by);
    } else {
      const f = remaining / len;
      path.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f);
    }
    remaining -= len;
  }
}

function createCanvas(width: number, height: number, dpr: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return { canvas, ctx };
}

export function createStage(width: number, height: number, dpr: number): Stage {
  const root = document.createElement("div");
  root.setAttribute(OVERLAY_ATTR, "");
  root.setAttribute("aria-hidden", "true");
  // Explicit px size, not inset/vh: on mobile both resolve against a viewport that can differ from
  // innerHeight while the URL bar is shown, which would misalign the shards with the page.
  root.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${width}px`,
    `height:${height}px`,
    "z-index:2147483647",
    "overflow:hidden",
    "contain:strict",
    "touch-action:none",
    "user-select:none",
    "-webkit-user-select:none",
  ].join(";");
  // Outside <body>, so capturing the body never includes the effect itself.
  document.documentElement.appendChild(root);
  return { root, width, height, dpr };
}

export interface CrackLayer {
  canvas: HTMLCanvasElement;
  /** Resolves once every crack, including late hairlines, has been drawn (or on abort) */
  finished: Promise<void>;
}

const FLASH_MS = 220;

export function startCracks(
  stage: Stage,
  fracture: Fracture,
  origin: Point,
  durationMs: number,
  signal: AbortSignal,
): CrackLayer {
  const { canvas, ctx } = createCanvas(stage.width, stage.height, stage.dpr);
  stage.root.appendChild(canvas);
  const end = Math.max(durationMs, ...fracture.cracks.map((c) => c.start + c.duration));

  const finished = new Promise<void>((resolve) => {
    const startedAt = performance.now();
    const frame = (now: number) => {
      const t = now - startedAt;
      ctx.clearRect(0, 0, stage.width, stage.height);
      if (t < FLASH_MS) drawFlash(ctx, origin, fracture.coreRadius, t / FLASH_MS);
      strokeCracks(ctx, fracture.cracks, t);
      if (t >= end || signal.aborted) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return { canvas, finished };
}

function drawFlash(ctx: CanvasRenderingContext2D, [x, y]: Point, coreRadius: number, p: number) {
  const r = coreRadius * (3 + p * 5);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  const a = (1 - p) * (1 - p);
  g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`);
  g.addColorStop(0.35, `rgba(215,235,255,${0.45 * a})`);
  g.addColorStop(1, "rgba(215,235,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

interface Piece {
  el: HTMLCanvasElement;
  /** Shard centroid relative to the canvas's top-left, i.e. the rotation pivot */
  pivotX: number;
  pivotY: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  wx: number;
  wy: number;
  wz: number;
  delay: number;
  done: boolean;
}

export interface ShatterTiming {
  gravity: number;
  /** Max delay between the first and the last shard letting go (s) */
  release: number;
}

/**
 * Cuts each shard out of the page bitmap (with the final crack pattern baked in, so hairlines ride
 * along on the falling pieces) and drops them. Canvases are only ever composited, never read back,
 * so a tainted page bitmap is fine.
 */
export function buildPieces(
  stage: Stage,
  page: HTMLCanvasElement,
  cracks: HTMLCanvasElement,
  shards: Shard[],
  origin: Point,
  timing: ShatterTiming,
  rng: () => number,
): Piece[] {
  const { dpr } = stage;
  const maxDist = Math.hypot(stage.width, stage.height);
  const pieces: Piece[] = [];

  for (const shard of shards) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of shard.polygon) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    // 1px bleed so anti-aliased neighbours overlap and no seam shows before they separate.
    minX = Math.floor(minX) - 1;
    minY = Math.floor(minY) - 1;
    const w = Math.ceil(maxX) + 1 - minX;
    const h = Math.ceil(maxY) + 1 - minY;

    const { canvas, ctx } = createCanvas(w, h, dpr);
    ctx.translate(-minX, -minY);
    const outline = new Path2D();
    shard.polygon.forEach(([x, y], i) => (i ? outline.lineTo(x, y) : outline.moveTo(x, y)));
    outline.closePath();
    ctx.save();
    ctx.clip(outline);
    ctx.drawImage(page, 0, 0, stage.width, stage.height);
    ctx.drawImage(cracks, 0, 0, stage.width, stage.height);
    // A faint cold tint gives the face a glassy cast once it tilts away from the viewer.
    ctx.fillStyle = "rgba(170, 205, 255, 0.07)";
    ctx.fill(outline);
    ctx.restore();
    // Bright rim: the polished fracture edge catching the light.
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.stroke(outline);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = "rgba(20, 30, 60, 0.35)";
    ctx.stroke(outline);

    canvas.style.left = `${minX}px`;
    canvas.style.top = `${minY}px`;
    canvas.style.transformOrigin = `${shard.centroid[0] - minX}px ${shard.centroid[1] - minY}px`;
    canvas.style.willChange = "transform, opacity";
    canvas.style.backfaceVisibility = "visible";

    const dx = shard.centroid[0] - origin[0];
    const dy = shard.centroid[1] - origin[1];
    const dist = Math.hypot(dx, dy) || 1;
    const near = 1 - Math.min(1, dist / maxDist);
    // Small pieces tumble faster than large slabs.
    const spin = 1.2 + 900 / Math.sqrt(shard.area + 400);
    const push = 60 + near * 260 * rng();
    pieces.push({
      el: canvas,
      pivotX: shard.centroid[0] - minX,
      pivotY: shard.centroid[1] - minY,
      x: 0,
      y: 0,
      z: 0,
      vx: (dx / dist) * push + (rng() - 0.5) * 60,
      vy: (dy / dist) * push * 0.6 - rng() * 120 * near,
      vz: 80 + rng() * 260 * near,
      rx: 0,
      ry: 0,
      rz: 0,
      wx: (rng() - 0.5) * spin * 2.2,
      wy: (rng() - 0.5) * spin * 2.2,
      wz: (rng() - 0.5) * spin,
      // The glass gives way at the impact first and the collapse ripples outward.
      delay: (1 - near) * timing.release + rng() * 0.08,
      done: false,
    });
  }
  return pieces;
}

interface Glint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  life: number;
}

/** Fine glass dust blown out of the crushed core; a single canvas redrawn per frame. */
function createGlints(origin: Point, coreRadius: number, rng: () => number): Glint[] {
  return Array.from({ length: 46 }, () => {
    const a = rng() * Math.PI * 2;
    const speed = 120 + rng() * 520;
    return {
      x: origin[0] + Math.cos(a) * coreRadius * rng(),
      y: origin[1] + Math.sin(a) * coreRadius * rng(),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 160,
      size: 1.5 + rng() * 4,
      angle: rng() * Math.PI,
      spin: (rng() - 0.5) * 20,
      life: 0.7 + rng() * 0.9,
    };
  });
}

function drawGlints(ctx: CanvasRenderingContext2D, glints: Glint[], t: number) {
  for (const g of glints) {
    const alpha = 1 - t / g.life;
    if (alpha <= 0) continue;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(235, 245, 255, 0.95)";
    ctx.beginPath();
    ctx.moveTo(0, -g.size);
    ctx.lineTo(g.size * 0.7, g.size * 0.6);
    ctx.lineTo(-g.size * 0.6, g.size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(30, 40, 70, 0.35)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }
}

const MAX_FALL_S = 3.2;
const MAX_STEP_S = 1 / 30;

export function runFall(
  stage: Stage,
  pieces: Piece[],
  origin: Point,
  coreRadius: number,
  timing: ShatterTiming,
  rng: () => number,
  signal: AbortSignal,
): Promise<void> {
  const { root, width, height } = stage;
  root.style.perspective = `${Math.max(width, height) * 1.4}px`;
  root.style.perspectiveOrigin = `${origin[0]}px ${origin[1]}px`;
  for (const p of pieces) root.appendChild(p.el);

  const glintLayer = createCanvas(width, height, Math.min(stage.dpr, 1.5));
  glintLayer.canvas.style.pointerEvents = "none";
  root.appendChild(glintLayer.canvas);
  const glints = createGlints(origin, coreRadius, rng);

  const tops = pieces.map((p) => parseFloat(p.el.style.top));
  const exitDepth = Math.hypot(width, height);

  return new Promise((resolve) => {
    let prev = performance.now();
    let elapsed = 0;
    const frame = (now: number) => {
      // Real dt keeps the fall speed identical at 60/120 Hz; the cap stops a hitch (tab switch,
      // GC pause) from teleporting every shard off-screen in one frame.
      const dt = Math.min(MAX_STEP_S, (now - prev) / 1000);
      prev = now;
      elapsed += dt;

      let alive = 0;
      pieces.forEach((p, i) => {
        if (p.done) return;
        alive++;
        const t = elapsed - p.delay;
        if (t < 0) {
          // The pane trembles under load just before it gives way.
          const k = Math.max(0, 1 + t / 0.25);
          const jx = (rng() - 0.5) * 1.6 * k;
          const jy = (rng() - 0.5) * 1.6 * k;
          p.el.style.transform = `translate3d(${jx}px,${jy}px,0)`;
          return;
        }
        p.vy += timing.gravity * dt;
        p.vx *= 1 - 0.25 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.rx += p.wx * dt;
        p.ry += p.wy * dt;
        p.rz += p.wz * dt;
        p.el.style.transform =
          `translate3d(${p.x}px,${p.y}px,${p.z}px) ` +
          `rotateX(${p.rx}rad) rotateY(${p.ry}rad) rotateZ(${p.rz}rad)`;

        const fade = elapsed > MAX_FALL_S - 0.5 ? Math.max(0, (MAX_FALL_S - elapsed) / 0.5) : 1;
        if (fade < 1) p.el.style.opacity = String(fade);
        if (tops[i] + p.y - exitDepth * 0.15 > height || fade === 0) {
          p.done = true;
          p.el.remove();
        }
      });

      const g = glintLayer.ctx;
      g.clearRect(0, 0, width, height);
      for (const gl of glints) {
        gl.vy += timing.gravity * 0.6 * dt;
        gl.x += gl.vx * dt;
        gl.y += gl.vy * dt;
        gl.angle += gl.spin * dt;
      }
      drawGlints(g, glints, elapsed);

      if (alive === 0 || elapsed >= MAX_FALL_S || signal.aborted) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

export type { Piece };
