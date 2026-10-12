import { describe, expect, it } from "vite-plus/test";
import {
  analyze,
  createRng,
  D,
  decodeHex,
  DIRS,
  generateLayout,
  type GenParams,
  type Layout,
  L,
  neighbor,
  opposite,
  R,
  rotateCW,
  rotateCWBy,
  scramble,
  SHORT_CIRCUIT,
  solve,
  U,
} from "./engine";
import levelData from "./levels.json";

const params = (over: Partial<GenParams>): GenParams => ({
  w: 3,
  h: 3,
  colors: 1,
  wrap: false,
  barrierRate: 0,
  sourceGap: 2,
  minTree: 2,
  ...over,
});

function layouts(p: GenParams, count: number, seed: number): Layout[] {
  const rng = createRng(seed);
  const out: Layout[] = [];
  while (out.length < count) {
    const layout = generateLayout(p, rng);
    if (layout) out.push(layout);
  }
  return out;
}

/** Independent reference: backtrack with only local wire matching, then check the full rules. */
function bruteForceCount(layout: Layout): number {
  const size = layout.w * layout.h;
  const tiles = Array.from({ length: size }, () => 0);
  const done = new Uint8Array(size);
  let count = 0;
  const place = (i: number) => {
    if (i === size) {
      if (analyze(layout, tiles).solved) count++;
      return;
    }
    const tried = new Set<number>();
    for (let t = 0; t < 4; t++) {
      const v = rotateCWBy(layout.solution[i], t);
      if (tried.has(v)) continue;
      tried.add(v);
      const fits = DIRS.every((d) => {
        const n = neighbor(layout, i, d);
        if (n < 0) return !(v & d);
        if (!done[n]) return true;
        return Boolean(v & d) === Boolean(tiles[n] & opposite(d));
      });
      if (!fits) continue;
      tiles[i] = v;
      done[i] = 1;
      place(i + 1);
      done[i] = 0;
    }
  };
  place(0);
  return count;
}

describe("tiles", () => {
  it("rotates clockwise on screen: right → down → left → up", () => {
    expect(rotateCW(R)).toBe(D);
    expect(rotateCW(D)).toBe(L);
    expect(rotateCW(L)).toBe(U);
    expect(rotateCW(U)).toBe(R);
    expect(rotateCW(R | U)).toBe(D | R);
  });
});

describe("analyze", () => {
  it("flags two sources joined by a wire as a short circuit", () => {
    const board = { w: 2, h: 1, wrap: false, barriers: [0, 0], sources: [0, 1] };
    const a = analyze(board, [R, L]);
    expect(Array.from(a.owner)).toEqual([SHORT_CIRCUIT, SHORT_CIRCUIT]);
    expect(a.solved).toBe(false);
  });

  it("marks every arm of a 2x2 ring as a loop", () => {
    const board = { w: 2, h: 2, wrap: false, barriers: [0, 0, 0, 0], sources: [0] };
    const a = analyze(board, [R | D, L | D, R | U, L | U]);
    expect(Array.from(a.loopArms)).toEqual([R | D, L | D, R | U, L | U]);
    expect(a.solved).toBe(false);
  });
});

describe("generator", () => {
  it("produces solved forests with one source per tree and scrambles them", () => {
    for (const layout of layouts(params({ w: 6, h: 6, colors: 3, sourceGap: 3 }), 20, 7)) {
      expect(analyze(layout, layout.solution).solved).toBe(true);
      const tiles = scramble(layout, createRng(1), 0.4);
      expect(tiles).not.toBeNull();
      expect(analyze(layout, tiles!).solved).toBe(false);
    }
  });
});

describe("solver", () => {
  const cases: Array<[string, GenParams]> = [
    ["3x3 single source", params({})],
    ["3x3 two sources", params({ colors: 2 })],
    ["4x3 two sources", params({ w: 4, colors: 2 })],
    ["4x4 three sources", params({ w: 4, h: 4, colors: 3 })],
    ["3x3 wrapping", params({ wrap: true })],
    ["4x4 wrapping two sources", params({ w: 4, h: 4, colors: 2, wrap: true })],
    ["4x4 with barriers", params({ w: 4, h: 4, colors: 2, barrierRate: 0.3 })],
  ];

  it.each(cases)("counts exactly the brute-force solutions: %s", (_, p) => {
    for (const layout of layouts(p, 25, 42)) {
      expect(solve(layout, layout.solution, 1e6).solutions).toBe(bruteForceCount(layout));
    }
  });

  it("returns the generated layout when deduction proves it unique", () => {
    let checked = 0;
    for (const layout of layouts(params({ w: 5, h: 5, colors: 2 }), 60, 3)) {
      const { solutions, stats, solution } = solve(layout, layout.solution);
      if (!stats.deducible) continue;
      expect(solutions).toBe(1);
      expect(solution).toEqual(layout.solution);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("levels.json", () => {
  it.each(levelData.map((l, i) => [i + 1, l] as const))(
    "level %i opens unsolved, error-free, and has one deducible solution",
    (_, l) => {
      const board = { ...l, barriers: decodeHex(l.barriers) };
      const tiles = decodeHex(l.tiles);
      const opening = analyze(board, tiles);
      expect(opening.solved).toBe(false);
      expect(opening.loopArms.some(Boolean)).toBe(false);
      expect(opening.owner.includes(SHORT_CIRCUIT)).toBe(false);
      const { solutions, stats } = solve(board, tiles);
      expect(solutions).toBe(1);
      expect(stats.deducible).toBe(true);
    },
  );
});
