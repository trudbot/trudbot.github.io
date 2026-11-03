// Checks the timing and scoring core without a browser: `pnpm test`.
import assert from "node:assert/strict";
import { LEVELS, SCORING } from "../src/game/config.ts";
import { RhythmRun, SweepRun, ease, nextBeat, type Grid } from "../src/game/qte.ts";
import { accuracyFor, scoreLevel, type StageRecord } from "../src/game/scoring.ts";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${name}\n     ${(error as Error).message}`);
  }
}

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test("every easing is monotone and pinned to the ends", () => {
  for (const shape of ["linear", "sine", "surge", "stutter"] as const) {
    assert.ok(near(ease(shape, 0), 0) && near(ease(shape, 1), 1), shape);
    for (let i = 1; i <= 1000; i++) assert.ok(ease(shape, i / 1000) >= ease(shape, (i - 1) / 1000), shape);
  }
});

test("all sweep crossings land on whole beats and the pointer sits on the zone there", () => {
  for (const level of LEVELS) {
    const grid: Grid = { anchor: 3.21, spb: 60 / level.bpm };
    for (const stage of level.stages) {
      if (stage.kind !== "sweep") continue;
      const run = new SweepRun(stage, grid, 10);
      assert.equal(run.targets.length, stage.passes);
      assert.ok(run.appear >= 10 - 1e-9, `${level.id} appears before it was asked to`);
      const [a, b] = run.span(0);
      for (const t of run.targets) {
        const beats = (t - grid.anchor) / grid.spb;
        assert.ok(near(beats, Math.round(beats), 1e-6), `${level.id} target off-grid: ${beats}`);
        assert.ok(near(run.pos(t), a) && near(a, b), `${level.id} pointer not on zone`);
      }
      const [p0, p1] = run.span(stage.perfect);
      const [g0, g1] = run.span(stage.good);
      assert.ok(g0 <= p0 && p0 < p1 && p1 <= g1, `${level.id} zones not nested`);
      // A zone placed where the easing stalls shrinks to a sliver the pointer
      // idles on, so what the player sees stops matching the timing window.
      assert.ok(p1 - p0 >= 0.04, `${level.id} PERFECT zone too thin to read: ${(p1 - p0).toFixed(3)}`);
    }
  }
});

test("rebound sweeps give the first chance quickly", () => {
  const stage = LEVELS[1].stages[1];
  assert.equal(stage.kind, "sweep");
  if (stage.kind !== "sweep") return;
  const grid: Grid = { anchor: 0, spb: 0.6 };
  const run = new SweepRun(stage, grid, 5);
  assert.ok(run.targets[0] - 5 <= 2 * grid.spb + 1e-9, "first crossing comes within two beats");
  assert.ok(near(run.pos(run.appear), 1), "starts at the far end");
});

test("a sweep judges exactly once and times out as MISS", () => {
  const stage = LEVELS[0].stages[0];
  if (stage.kind !== "sweep") throw new Error("expected sweep");
  const run = new SweepRun(stage, { anchor: 0, spb: 60 / LEVELS[0].bpm }, 0);
  const t = run.targets[1];
  assert.equal(run.press(t + stage.perfect / 2)?.grade, "PERFECT");
  assert.equal(run.press(t), null, "second press ignored");
  const late = new SweepRun(stage, { anchor: 0, spb: 0.5 }, 0);
  assert.equal(late.update(late.end - 0.001), null);
  assert.equal(late.update(late.end + 0.001)?.grade, "MISS");
  const off = new SweepRun(stage, { anchor: 0, spb: 0.5 }, 0);
  assert.equal(off.press(off.targets[0] + stage.good + 0.02)?.grade, "MISS");
  const good = new SweepRun(stage, { anchor: 0, spb: 0.5 }, 0);
  assert.equal(good.press(good.targets[0] - (stage.perfect + stage.good) / 2)?.grade, "GOOD");
});

test("presses right after a QTE appears are ignored", () => {
  const stage = LEVELS[1].stages[1];
  if (stage.kind !== "sweep") throw new Error("expected sweep");
  const run = new SweepRun(stage, { anchor: 0, spb: 0.6 }, 1);
  assert.equal(run.press(run.appear + 0.05), null);
  assert.equal(run.result, null);
});

test("rhythm taps follow the grid, ignore bounces and fail on stray presses", () => {
  const stage = LEVELS[3].stages[1];
  if (stage.kind !== "rhythm") throw new Error("expected rhythm");
  const grid: Grid = { anchor: 0, spb: 0.5 };
  const run = new RhythmRun(stage, grid, 0.3);
  assert.equal(run.taps.length, stage.taps);
  run.taps.forEach((t, i) => {
    assert.equal(run.press(t + 0.01)?.grade, "PERFECT", `tap ${i}`);
    if (i < run.taps.length - 1) assert.equal(run.press(t + 0.05), null, "bounce ignored");
  });
  assert.equal(run.summary().grade, "PERFECT");

  const stray = new RhythmRun(stage, grid, 0.3);
  assert.equal(stray.press(stray.taps[0] - 0.3)?.grade, "MISS");
  assert.equal(stray.summary().grade, "MISS");

  const idle = new RhythmRun(stage, grid, 0.3);
  idle.press(idle.taps[0]);
  assert.equal(idle.update(idle.taps[1] + stage.good + 0.01)?.grade, "MISS");
});

test("accuracy bands keep PERFECT above GOOD", () => {
  const [p, g] = [0.05, 0.13];
  assert.equal(accuracyFor(0, p, g), 1);
  assert.ok(near(accuracyFor(p, p, g), SCORING.perfectFloor));
  assert.ok(accuracyFor(p + 1e-4, p, g) <= SCORING.goodCeil);
  assert.ok(near(accuracyFor(g, p, g), SCORING.goodFloor));
  assert.equal(accuracyFor(g + 0.001, p, g), 0);
});

const rec = (stage: number, grade: StageRecord["grade"], accuracy: number, weight = 1): StageRecord => ({
  stage,
  grade,
  accuracy,
  offset: 0,
  pressAt: 0,
  weight,
});

test("any MISS fails the level and names the stage", () => {
  const r = scoreLevel(LEVELS[2], [rec(0, "PERFECT", 1), rec(1, "MISS", 0)]);
  assert.equal(r.passed, false);
  assert.equal(r.stars, 0);
  assert.equal(r.failedStage, 1);
});

test("an incomplete run cannot pass", () => {
  assert.equal(scoreLevel(LEVELS[2], [rec(0, "PERFECT", 1)]).passed, false);
});

test("stars need consistency, not one great hit", () => {
  const lvl = LEVELS[2];
  assert.equal(scoreLevel(lvl, [rec(0, "PERFECT", 0.98), rec(1, "PERFECT", 0.95), rec(2, "PERFECT", 0.97)]).stars, 3);
  assert.equal(scoreLevel(lvl, [rec(0, "PERFECT", 1), rec(1, "PERFECT", 1), rec(2, "GOOD", 0.78, 1.6)]).stars, 2);
  assert.equal(scoreLevel(lvl, [rec(0, "PERFECT", 1, 1), rec(1, "GOOD", 0.4), rec(2, "GOOD", 0.4, 1.6)]).stars, 1);
});

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
