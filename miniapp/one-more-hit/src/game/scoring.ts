import { SCORING, type Grade, type LevelDef } from "./config.ts";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Accuracy from absolute timing error. Inside the PERFECT window it falls
 * from 1 to `perfectFloor`; inside GOOD from `goodCeil` to `goodFloor`;
 * beyond GOOD it is 0. The gap between the bands keeps grades and scores
 * consistent: no GOOD ever scores above a PERFECT.
 */
export function accuracyFor(err: number, perfect: number, good: number): number {
  if (err <= perfect) return 1 - (1 - SCORING.perfectFloor) * clamp01(err / perfect);
  if (err <= good) {
    const k = clamp01((err - perfect) / (good - perfect));
    return SCORING.goodCeil - (SCORING.goodCeil - SCORING.goodFloor) * k;
  }
  return 0;
}

export interface StageRecord {
  stage: number;
  grade: Grade;
  accuracy: number;
  /** Signed seconds from the target; Infinity when the stage timed out. */
  offset: number;
  pressAt: number;
  weight: number;
  /** Per-tap grades for rhythm stages. */
  taps?: Grade[];
}

export interface LevelResult {
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  /** Weighted mean accuracy over every stage, 0…1. */
  accuracy: number;
  score: number;
  perfects: number;
  /** First failed stage, when `passed` is false. */
  failedStage?: number;
}

export function scoreLevel(level: LevelDef, records: StageRecord[]): LevelResult {
  const perfects = records.filter((r) => r.grade === "PERFECT").length;
  const miss = records.find((r) => r.grade === "MISS");
  // Every stage is required: a level only counts once all of them resolved.
  if (miss || records.length < level.stages.length) {
    return {
      passed: false,
      stars: 0,
      accuracy: 0,
      score: 0,
      perfects,
      failedStage: miss?.stage ?? records.length,
    };
  }
  const total = records.reduce((a, r) => a + r.weight, 0);
  const accuracy = records.reduce((a, r) => a + r.accuracy * r.weight, 0) / total;
  const min = Math.min(...records.map((r) => r.accuracy));
  const { three, two } = SCORING.stars;
  const stars = accuracy >= three.avg && min >= three.min ? 3 : accuracy >= two.avg && min >= two.min ? 2 : 1;
  return { passed: true, stars, accuracy, score: Math.round(accuracy * SCORING.scoreScale), perfects };
}
