/*
 * Gameplay tuning in one place: level order, QTE stages and scoring
 * thresholds. Timing windows are in seconds of timing error; motion periods
 * are in beats so every stage stays locked to its level's tempo.
 */

export type Grade = "PERFECT" | "GOOD" | "MISS";

/**
 * Easing applied to the there-and-back sweep. All shapes are monotone on the
 * outbound leg and mirrored on the return leg, so the pointer crosses the zone
 * at the same speed both ways and one time window fits both crossings.
 */
export type Shape = "linear" | "sine" | "surge" | "stutter";

export interface SweepStage {
  kind: "sweep";
  shape: Shape;
  /** Beats for one full out-and-back sweep. */
  period: number;
  /**
   * When the pointer meets the zone, as a fraction of the outbound leg. The
   * zone's track position follows from the shape; choosing `hit` instead of a
   * position keeps every crossing on the eighth-note grid.
   */
  hit: number;
  perfect: number;
  good: number;
  /** Zone crossings offered before the stage times out as a MISS. */
  passes: number;
  weight: number;
  /**
   * Hammer rebound: the sweep starts at the far end already heading back, so
   * the first chance comes right after the previous impact.
   */
  rebound?: boolean;
  /** Hidden from the HUD count until it springs up after a fake finish. */
  surprise?: boolean;
}

export interface RhythmStage {
  kind: "rhythm";
  taps: number;
  /** Beats between taps. */
  interval: number;
  perfect: number;
  good: number;
  weight: number;
}

export type Stage = SweepStage | RhythmStage;

export type SceneId = "pot" | "pots" | "boulder" | "mountain" | "earth" | "cosmos";

export interface LevelDef {
  id: SceneId;
  name: string;
  en: string;
  tagline: string;
  bpm: number;
  /** MIDI note of the tonic; the progression is built on it. */
  key: number;
  stages: Stage[];
}

const sweep = (s: Omit<SweepStage, "kind">): SweepStage => ({ kind: "sweep", ...s });
const rhythm = (s: Omit<RhythmStage, "kind">): RhythmStage => ({ kind: "rhythm", ...s });

export const LEVELS: LevelDef[] = [
  {
    id: "pot",
    name: "孤独的小罐子",
    en: "THE LONELY POT",
    tagline: "指针进入金色区域时出手",
    bpm: 92,
    key: 57,
    stages: [
      sweep({ shape: "linear", period: 4, hit: 0.5, perfect: 0.075, good: 0.19, passes: 6, weight: 1 }),
    ],
  },
  {
    id: "pots",
    name: "罐子阵列",
    en: "POT ARRAY",
    tagline: "第一锤只是开始",
    bpm: 100,
    key: 59,
    stages: [
      sweep({ shape: "sine", period: 4, hit: 0.25, perfect: 0.065, good: 0.16, passes: 6, weight: 1 }),
      sweep({
        shape: "linear",
        period: 2,
        hit: 0.5,
        perfect: 0.06,
        good: 0.15,
        passes: 5,
        weight: 1.4,
        rebound: true,
      }),
    ],
  },
  {
    id: "boulder",
    name: "巨石",
    en: "THE BOULDER",
    tagline: "每一锤都更沉",
    bpm: 104,
    key: 52,
    stages: [
      sweep({ shape: "sine", period: 4, hit: 0.75, perfect: 0.06, good: 0.15, passes: 5, weight: 1 }),
      sweep({ shape: "surge", period: 4, hit: 0.5, perfect: 0.055, good: 0.14, passes: 4, weight: 1.2 }),
      sweep({
        shape: "linear",
        period: 2,
        hit: 0.5,
        perfect: 0.055,
        good: 0.14,
        passes: 4,
        weight: 1.6,
        rebound: true,
      }),
    ],
  },
  {
    id: "mountain",
    name: "山脉",
    en: "THE RANGE",
    tagline: "跟着鼓点连砸，再来一记开山",
    bpm: 110,
    key: 50,
    stages: [
      sweep({ shape: "stutter", period: 4, hit: 0.5, perfect: 0.055, good: 0.14, passes: 5, weight: 1 }),
      rhythm({ taps: 4, interval: 1, perfect: 0.06, good: 0.14, weight: 1.2 }),
      sweep({
        shape: "surge",
        period: 2,
        hit: 0.5,
        perfect: 0.05,
        good: 0.13,
        passes: 4,
        weight: 1.8,
        rebound: true,
      }),
    ],
  },
  {
    id: "earth",
    name: "地球",
    en: "PLANET EARTH",
    tagline: "地壳在你脚下发抖",
    bpm: 116,
    key: 55,
    stages: [
      sweep({ shape: "sine", period: 4, hit: 0.25, perfect: 0.05, good: 0.13, passes: 5, weight: 1 }),
      sweep({
        shape: "stutter",
        period: 4,
        hit: 0.5,
        perfect: 0.05,
        good: 0.13,
        passes: 4,
        weight: 1.3,
        rebound: true,
      }),
      sweep({ shape: "linear", period: 2, hit: 0.5, perfect: 0.048, good: 0.12, passes: 4, weight: 1.8 }),
    ],
  },
  {
    id: "cosmos",
    name: "宇宙",
    en: "THE UNIVERSE",
    tagline: "最后一锤，砸穿一切",
    bpm: 120,
    key: 53,
    stages: [
      sweep({ shape: "stutter", period: 4, hit: 0.5, perfect: 0.05, good: 0.13, passes: 4, weight: 1 }),
      rhythm({ taps: 6, interval: 0.5, perfect: 0.055, good: 0.12, weight: 1.2 }),
      sweep({
        shape: "surge",
        period: 2,
        hit: 0.5,
        perfect: 0.048,
        good: 0.12,
        passes: 4,
        weight: 1.4,
        rebound: true,
      }),
      sweep({
        shape: "sine",
        period: 2,
        hit: 0.5,
        perfect: 0.045,
        good: 0.11,
        passes: 3,
        weight: 2,
        surprise: true,
      }),
    ],
  },
];

/**
 * Accuracy bands and star thresholds. PERFECT and GOOD map into disjoint
 * accuracy bands so a GOOD can never outscore a PERFECT, and the `min`
 * requirements stop one great hit from hiding a sloppy one.
 */
export const SCORING = {
  /** Accuracy at the edge of the PERFECT window (centre is 1). */
  perfectFloor: 0.85,
  /** Accuracy just outside the PERFECT window, falling to `goodFloor` at the GOOD edge. */
  goodCeil: 0.8,
  goodFloor: 0.35,
  stars: {
    three: { avg: 0.92, min: 0.85 },
    two: { avg: 0.7, min: 0.5 },
  },
  scoreScale: 10000,
} as const;

/** How early a press may come before a rhythm tap's GOOD window and still be ignored instead of failing. */
export const RHYTHM_GRACE = 0.12;
