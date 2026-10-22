// 纯几何：生成「蛛网状」裂纹与碎片。裂纹线与碎片边界取自同一组折线，
// 所以碎片下落前的轮廓与屏幕上已画出的裂纹严丝合缝。

export type Point = [number, number];

export type CrackKind = "crush" | "radial" | "ring" | "hairline";

export interface Crack {
  points: Point[];
  /** ms after impact */
  start: number;
  duration: number;
  kind: CrackKind;
}

export interface Shard {
  /** Viewport-clipped outline in viewport px */
  polygon: Point[];
  centroid: Point;
  area: number;
}

export interface Fracture {
  cracks: Crack[];
  shards: Shard[];
  /** Radius of the pulverised zone around the impact; it has no shard and turns into dust */
  coreRadius: number;
}

export interface FractureOptions {
  width: number;
  height: number;
  origin: Point;
  /** Visible cracks finish spreading at this time (ms after impact) */
  spreadMs: number;
  /** Hairlines keep appearing until spreadMs + holdMs */
  holdMs: number;
  rng?: () => number;
}

/** The initial "nail hit" star keeps its own fast timing and is never rescaled. */
const IMPACT_MS = 160;
/** Fraction of the impact-to-farthest-corner distance at which each inner ring sits. */
const RING_FRACTIONS = [0.17, 0.4, 0.68];
/** Probability that an inner ring arc exists; a missing arc merges two shards into a longer one. */
const RING_ARC_CHANCE = 0.72;

export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function polygonArea(poly: Point[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return Math.abs(sum) / 2;
}

function polygonCentroid(poly: Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += cross;
    cx += (poly[j][0] + poly[i][0]) * cross;
    cy += (poly[j][1] + poly[i][1]) * cross;
  }
  if (Math.abs(a) < 1e-9) return poly[0];
  return [cx / (3 * a), cy / (3 * a)];
}

/** Sutherland–Hodgman against the viewport rect; correct for concave subjects because the clip region is convex. */
function clipToRect(poly: Point[], width: number, height: number): Point[] {
  const edges: Array<[(p: Point) => boolean, (a: Point, b: Point) => Point]> = [
    [(p) => p[0] >= 0, (a, b) => lerpAt(a, b, 0, 0)],
    [(p) => p[0] <= width, (a, b) => lerpAt(a, b, 0, width)],
    [(p) => p[1] >= 0, (a, b) => lerpAt(a, b, 1, 0)],
    [(p) => p[1] <= height, (a, b) => lerpAt(a, b, 1, height)],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cut(prev, cur));
      }
    }
  }
  return out;
}

function lerpAt(a: Point, b: Point, axis: 0 | 1, value: number): Point {
  const t = (value - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function cumulativeLengths(points: Point[]): number[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(
      cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  }
  return cum;
}

export function crackLengths(crack: Crack): number[] {
  return cumulativeLengths(crack.points);
}

/** Ease-out reveal: cracks race away from the stress point and slow down as they run out of energy. */
export function crackProgress(crack: Crack, t: number): number {
  const u = Math.min(1, Math.max(0, (t - crack.start) / crack.duration));
  return 1 - (1 - u) * (1 - u);
}

/** Inverse of crackProgress: when the crack front reaches `fraction` of its length. */
function arrivalTime(crack: Crack, fraction: number): number {
  return crack.start + crack.duration * (1 - Math.sqrt(1 - Math.min(1, Math.max(0, fraction))));
}

interface Radial {
  points: Point[];
  /** Index into points of each boundary level: 0 = core, 1..rings, last = far point */
  nodes: number[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function pointInPolygon([x, y]: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Radials are generated in polar form with a bounded angular drift, so neighbouring radials can
 * never cross; every shard is then the region between two adjacent radials and two ring levels.
 */
function buildRadial(
  ox: number,
  oy: number,
  angle: number,
  coreRadius: number,
  levelRadii: number[],
  farRadius: number,
  maxDrift: number,
  rng: () => number,
): Radial {
  const radii = [coreRadius];
  const nodes = [0];
  for (const target of [...levelRadii, farRadius]) {
    let r = radii[radii.length - 1];
    for (;;) {
      // Finer steps near the impact make the inner cracks look sharper and more jagged.
      r += 10 + Math.min(r * 0.06, 18) + rng() * 16;
      if (r >= target - 6) break;
      radii.push(r);
    }
    radii.push(target);
    nodes.push(radii.length - 1);
  }

  let drift = 0;
  const points = radii.map((r, i): Point => {
    if (i > 0) drift = clamp(drift + (rng() - 0.5) * maxDrift * 0.7, -maxDrift, maxDrift);
    const a = angle + drift;
    return [ox + Math.cos(a) * r, oy + Math.sin(a) * r];
  });
  return { points, nodes };
}

/** Straight-ish crack between two points with small perpendicular jitter (endpoints exact). */
function jaggedLine(a: Point, b: Point, rng: () => number, amplitude: number): Point[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.round(len / 22));
  const nx = -(b[1] - a[1]) / (len || 1);
  const ny = (b[0] - a[0]) / (len || 1);
  const out: Point[] = [a];
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const j = (rng() - 0.5) * 2 * amplitude;
    out.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j]);
  }
  out.push(b);
  return out;
}

function arcPoints(ox: number, oy: number, r: number, a0: number, a1: number): Point[] {
  const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.15));
  return Array.from({ length: steps + 1 }, (_, s): Point => {
    const a = a0 + ((a1 - a0) * s) / steps;
    return [ox + Math.cos(a) * r, oy + Math.sin(a) * r];
  });
}

export function buildFracture(options: FractureOptions): Fracture {
  const { width, height, origin, spreadMs, holdMs } = options;
  const rng = options.rng ?? Math.random;
  const [ox, oy] = origin;
  const maxR = Math.max(
    Math.hypot(ox, oy),
    Math.hypot(width - ox, oy),
    Math.hypot(ox, height - oy),
    Math.hypot(width - ox, height - oy),
  );
  // Far ends sit outside the viewport so every outer shard reaches the screen edge after clipping.
  const farRadius = maxR + 60;
  const coreRadius = 12 + Math.min(width, height) * 0.012;

  // More radials on larger screens keep shard size roughly constant.
  const radialCount = Math.round(clamp(10 + maxR / 70, 13, 22));
  const step = (Math.PI * 2) / radialCount;
  const base = rng() * Math.PI * 2;
  const angles = Array.from(
    { length: radialCount },
    (_, i) => base + i * step + (rng() - 0.5) * step * 0.55,
  );

  const radials = angles.map((angle) => {
    const levels = RING_FRACTIONS.map((f) => f * maxR * (0.88 + rng() * 0.24));
    // Base angles stay ≥ 0.45·step apart; capping drift at 0.18·step keeps neighbours from touching.
    return buildRadial(ox, oy, angle, coreRadius, levels, farRadius, step * 0.18, rng);
  });
  const levelCount = RING_FRACTIONS.length + 2; // core + rings + far

  const cracks: Crack[] = [];
  // arrival[i][k]: when radial i's crack front reaches level k
  const arrival: number[][] = [];
  const impactReach = 0.14 * maxR;
  radials.forEach((radial) => {
    const lengths = cumulativeLengths(radial.points);
    const total = lengths[lengths.length - 1];
    // The impact star shoots out immediately; the rest advances in stuttering bursts.
    const burstCount = 2 + Math.floor(rng() * 2);
    const cuts = [0, Math.min(impactReach, total * 0.3)];
    for (let b = 1; b < burstCount; b++) cuts.push(cuts[1] + ((total - cuts[1]) * b) / burstCount);
    cuts.push(total);

    let cursor = rng() * 40;
    const pieces: Crack[] = [];
    for (let b = 0; b < cuts.length - 1; b++) {
      const piece = sliceByLength(radial.points, lengths, cuts[b], cuts[b + 1]);
      const duration = b === 0 ? IMPACT_MS * (0.6 + rng() * 0.4) : 180 + rng() * 260;
      if (b > 0) cursor += 60 + rng() * 380;
      pieces.push({ points: piece, start: cursor, duration, kind: "radial" });
      cursor += duration;
    }
    // Squeeze everything after the impact star into the spread window.
    const impactEnd = pieces[0].start + pieces[0].duration;
    const scale = cursor > spreadMs ? (spreadMs - impactEnd) / (cursor - impactEnd) : 1;
    for (const p of pieces.slice(1)) {
      p.start = impactEnd + (p.start - impactEnd) * scale;
      p.duration *= scale;
    }
    cracks.push(...pieces);

    arrival.push(
      radial.nodes.map((node) => {
        const at = lengths[node];
        let piece = pieces.findIndex((_, b) => at <= cuts[b + 1] + 1e-6);
        if (piece === -1) piece = pieces.length - 1;
        const from = cuts[piece];
        return arrivalTime(pieces[piece], (at - from) / Math.max(1e-6, cuts[piece + 1] - from));
      }),
    );
  });

  // Ring segments between adjacent radials. Level 0 is the crushed core and the last level is
  // off-screen; both always close their shards but only inner rings are drawn as cracks.
  const ringPaths: Array<Array<Point[] | null>> = radials.map((radial, i) => {
    const next = radials[(i + 1) % radialCount];
    return Array.from({ length: levelCount }, (_, k) => {
      const a = radial.points[radial.nodes[k]];
      const b = next.points[next.nodes[k]];
      if (k === levelCount - 1) {
        const a0 = Math.atan2(a[1] - oy, a[0] - ox);
        let a1 = Math.atan2(b[1] - oy, b[0] - ox);
        while (a1 <= a0) a1 += Math.PI * 2;
        const arc = arcPoints(ox, oy, farRadius, a0, a1);
        arc[0] = a;
        arc[arc.length - 1] = b;
        return arc;
      }
      if (k === 0) return [a, b];
      if (rng() > RING_ARC_CHANCE) return null;
      const path = jaggedLine(a, b, rng, 2.5);
      const ready = Math.max(arrival[i][k], arrival[(i + 1) % radialCount][k]);
      const forward = rng() < 0.5;
      cracks.push({
        points: forward ? path : [...path].reverse(),
        start: Math.min(ready + 30 + rng() * 220, spreadMs),
        duration: 70 + rng() * 120,
        kind: "ring",
      });
      return path;
    });
  });

  const shards: Shard[] = [];
  radials.forEach((radial, i) => {
    const next = radials[(i + 1) % radialCount];
    let lo = 0;
    for (let k = 1; k < levelCount; k++) {
      const upper = ringPaths[i][k];
      if (!upper) continue;
      const lower = ringPaths[i][lo]!;
      const poly: Point[] = [
        ...radial.points.slice(radial.nodes[lo], radial.nodes[k] + 1),
        ...upper.slice(1, -1),
        ...next.points.slice(next.nodes[lo], next.nodes[k] + 1).reverse(),
        ...[...lower].reverse().slice(1, -1),
      ];
      lo = k;
      const clipped = clipToRect(poly, width, height);
      if (clipped.length < 3) continue;
      const area = polygonArea(clipped);
      if (area < 20) continue;
      shards.push({ polygon: clipped, centroid: polygonCentroid(clipped), area });
    }
  });

  cracks.push(...buildCrush(origin, coreRadius, rng));
  cracks.push(...buildHairlines(shards, origin, maxR, spreadMs, holdMs, rng));
  return { cracks, shards, coreRadius };
}

function sliceByLength(points: Point[], lengths: number[], from: number, to: number): Point[] {
  const at = (d: number): Point => {
    const i = Math.max(
      1,
      lengths.findIndex((l) => l >= d),
    );
    const seg = lengths[i] - lengths[i - 1] || 1;
    const t = clamp((d - lengths[i - 1]) / seg, 0, 1);
    return [
      points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t,
      points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t,
    ];
  };
  const out: Point[] = [at(from)];
  for (let i = 0; i < points.length; i++) {
    if (lengths[i] > from && lengths[i] < to) out.push(points[i]);
  }
  out.push(at(to));
  return out;
}

/** Dense, tiny cracks of the crushed zone right at the point of impact. */
function buildCrush([ox, oy]: Point, coreRadius: number, rng: () => number): Crack[] {
  return Array.from({ length: 28 }, (): Crack => {
    const a = rng() * Math.PI * 2;
    const r = rng() * coreRadius * 1.8;
    const dir = a + (rng() - 0.5) * 2.4;
    const len = 3 + rng() * coreRadius * 1.1;
    const x = ox + Math.cos(a) * r;
    const y = oy + Math.sin(a) * r;
    return {
      points: [
        [x, y],
        [x + Math.cos(dir) * len, y + Math.sin(dir) * len],
      ],
      start: rng() * IMPACT_MS * 0.7,
      duration: 30 + rng() * 60,
      kind: "crush",
    };
  });
}

/**
 * Short cosmetic cracks that keep appearing after the main web has formed — the glass "creaking"
 * before it gives way. Each stays inside one shard so it never crosses a fall boundary.
 */
function buildHairlines(
  shards: Shard[],
  origin: Point,
  maxR: number,
  spreadMs: number,
  holdMs: number,
  rng: () => number,
): Crack[] {
  const out: Crack[] = [];
  for (const shard of shards) {
    const dist = Math.hypot(shard.centroid[0] - origin[0], shard.centroid[1] - origin[1]);
    // Stress concentrates near the impact, so inner shards get more hairlines.
    const count = Math.round((1 - dist / maxR) * 3 * rng() + (shard.area > 9000 ? 1 : 0));
    for (let n = 0; n < count; n++) {
      const v = shard.polygon[Math.floor(rng() * shard.polygon.length)];
      const t = 0.2 + rng() * 0.5;
      const start: Point = [
        v[0] + (shard.centroid[0] - v[0]) * t,
        v[1] + (shard.centroid[1] - v[1]) * t,
      ];
      const angle = rng() * Math.PI * 2;
      const len = 14 + rng() * Math.min(70, Math.sqrt(shard.area) * 0.45);
      const points: Point[] = [start];
      let [x, y] = start;
      let a = angle;
      const steps = Math.max(2, Math.round(len / 9));
      for (let s = 0; s < steps; s++) {
        a += (rng() - 0.5) * 0.7;
        const nx = x + Math.cos(a) * (len / steps);
        const ny = y + Math.sin(a) * (len / steps);
        if (!pointInPolygon([nx, ny], shard.polygon)) break;
        x = nx;
        y = ny;
        points.push([x, y]);
      }
      if (points.length < 2) continue;
      out.push({
        points,
        start: spreadMs * (0.55 + rng() * 0.45) + rng() * holdMs * 0.9,
        duration: 90 + rng() * 160,
        kind: "hairline",
      });
    }
  }
  return out;
}
