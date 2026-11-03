/*
 * QTE timing and judgement. Pure functions over the shared game clock
 * (seconds), so judgement never depends on audio callbacks or frame rate.
 */
import { RHYTHM_GRACE, type Grade, type RhythmStage, type Shape, type SweepStage } from "./config.ts";
import { accuracyFor } from "./scoring.ts";

/** Beat grid shared by music and gameplay: beat n sounds at `anchor + n * spb`. */
export interface Grid {
  anchor: number;
  spb: number;
}

export const nextBeat = (g: Grid, t: number, step = 1) =>
  g.anchor + Math.ceil((t - g.anchor) / (g.spb * step) - 1e-6) * g.spb * step;

export function ease(shape: Shape, s: number): number {
  switch (shape) {
    case "linear":
      return s;
    case "sine":
      return 0.5 - 0.5 * Math.cos(Math.PI * s);
    case "surge":
      // Slow lift-off, then a rush into the far end.
      return s * s * (0.35 + 0.65 * s);
    case "stutter":
      // Amplitude stays below 1/(4π) so the sweep never reverses mid-leg. It
      // nearly stalls at the quarter points, so zones belong at the half.
      return s + 0.075 * Math.sin(4 * Math.PI * s);
  }
}

const tri = (u: number) => {
  const f = u - Math.floor(u);
  return 1 - Math.abs(1 - 2 * f);
};

export interface Judgement {
  grade: Grade;
  /** Signed seconds: negative is early. */
  offset: number;
  accuracy: number;
  at: number;
}

export function judge(offset: number, perfect: number, good: number, at: number): Judgement {
  const err = Math.abs(offset);
  const grade: Grade = err <= perfect ? "PERFECT" : err <= good ? "GOOD" : "MISS";
  return { grade, offset, accuracy: accuracyFor(err, perfect, good), at };
}

/** Presses this soon after a QTE appears are leftovers from the previous hit, not attempts. */
export const ARM_DELAY = 0.12;

export class SweepRun {
  readonly T: number;
  readonly t0: number;
  readonly appear: number;
  readonly targets: number[] = [];
  readonly end: number;
  result: Judgement | null = null;
  readonly stage: SweepStage;

  constructor(stage: SweepStage, grid: Grid, earliest: number) {
    this.stage = stage;
    const T = (this.T = stage.period * grid.spb);
    const phase0 = stage.rebound ? 0.5 : 0;
    // Crossings of the zone in phase units: hit/2 outbound, 1-hit/2 on the way back.
    const crossings: number[] = [];
    for (let k = 0; crossings.length < stage.passes + 2; k++) {
      for (const u of [k + stage.hit / 2, k + 1 - stage.hit / 2]) if (u >= phase0) crossings.push(u);
    }
    const lead = (crossings[0] - phase0) * T;
    const first = nextBeat(grid, earliest + lead);
    this.appear = first - lead;
    this.t0 = this.appear - phase0 * T;
    for (let i = 0; i < stage.passes; i++) this.targets.push(this.t0 + crossings[i] * T);
    this.end = this.targets[this.targets.length - 1] + stage.good;
  }

  pos(t: number): number {
    return ease(this.stage.shape, tri((Math.max(t, this.appear) - this.t0) / this.T));
  }

  /** Track span covered by ±window around a crossing, for drawing the zones. */
  span(window: number): [number, number] {
    const u = this.stage.hit / 2;
    const d = window / this.T;
    const a = ease(this.stage.shape, Math.max(0, 2 * (u - d)));
    const b = ease(this.stage.shape, Math.min(1, 2 * (u + d)));
    return [a, b];
  }

  nearest(t: number): number {
    let best = this.targets[0];
    for (const x of this.targets) if (Math.abs(x - t) < Math.abs(best - t)) best = x;
    return best;
  }

  /** 0 far from any crossing, 1 at a crossing; drives music and pose tension. */
  tension(t: number): number {
    const d = Math.abs(this.nearest(t) - t);
    return Math.max(0, 1 - d / (this.T * 0.25));
  }

  /** Locks the result; later presses are ignored. Returns null for ignored presses. */
  press(t: number): Judgement | null {
    if (this.result || t < this.appear + ARM_DELAY) return null;
    const target = this.nearest(t);
    this.result = judge(t - target, this.stage.perfect, this.stage.good, t);
    return this.result;
  }

  /** Called every frame; times the stage out once the last crossing has passed. */
  update(t: number): Judgement | null {
    if (this.result || t <= this.end) return null;
    this.result = { grade: "MISS", offset: Infinity, accuracy: 0, at: t };
    return this.result;
  }
}

export class RhythmRun {
  readonly taps: number[] = [];
  readonly results: Judgement[] = [];
  /** Beats of approach shown before each tap. */
  readonly approach = 2;
  readonly appear: number;
  failed = false;
  private lastHit = -Infinity;
  readonly stage: RhythmStage;
  readonly grid: Grid;

  constructor(stage: RhythmStage, grid: Grid, earliest: number) {
    this.stage = stage;
    this.grid = grid;
    const first = nextBeat(grid, earliest + this.approach * grid.spb);
    for (let i = 0; i < stage.taps; i++) this.taps.push(first + i * stage.interval * grid.spb);
    this.appear = first - this.approach * grid.spb;
  }

  get done() {
    return this.failed || this.results.length === this.taps.length;
  }

  get next(): number | undefined {
    return this.taps[this.results.length];
  }

  tension(t: number): number {
    const n = this.next;
    if (n === undefined) return 0;
    return Math.max(0, 1 - Math.abs(n - t) / (this.stage.interval * this.grid.spb));
  }

  press(t: number): Judgement | null {
    const target = this.next;
    if (this.done || target === undefined || t < this.appear + ARM_DELAY) return null;
    const offset = t - target;
    // A double press right after a hit is the same intent bouncing, not a new attempt.
    if (offset < -this.stage.good && t - this.lastHit < RHYTHM_GRACE) return null;
    const j = judge(offset, this.stage.perfect, this.stage.good, t);
    if (j.grade === "MISS") this.failed = true;
    else this.lastHit = t;
    this.results.push(j);
    return j;
  }

  update(t: number): Judgement | null {
    const target = this.next;
    if (this.done || target === undefined || t <= target + this.stage.good) return null;
    this.failed = true;
    const j: Judgement = { grade: "MISS", offset: Infinity, accuracy: 0, at: t };
    this.results.push(j);
    return j;
  }

  /** Stage-level verdict once every tap has resolved. */
  summary(): Judgement {
    const last = this.results[this.results.length - 1];
    if (this.failed) return { ...last, grade: "MISS", accuracy: 0 };
    const accuracy = this.results.reduce((a, r) => a + r.accuracy, 0) / this.results.length;
    const grade: Grade = this.results.every((r) => r.grade === "PERFECT") ? "PERFECT" : "GOOD";
    return { grade, offset: last.offset, accuracy, at: last.at };
  }
}

export type StageRun = SweepRun | RhythmRun;
