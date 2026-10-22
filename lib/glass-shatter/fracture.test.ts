import { describe, expect, it } from "vite-plus/test";
import { buildFracture, createRng, pointInPolygon, type Point } from "./fracture";

const CASES: Array<{ name: string; width: number; height: number; origin: Point }> = [
  { name: "phone, avatar near top", width: 390, height: 844, origin: [195, 230] },
  { name: "desktop, center", width: 1440, height: 900, origin: [720, 450] },
  { name: "desktop, near corner", width: 1280, height: 720, origin: [30, 40] },
  { name: "origin on the edge", width: 800, height: 600, origin: [800, 300] },
];

describe("buildFracture", () => {
  for (const { name, width, height, origin } of CASES) {
    for (const seed of [1, 7, 42]) {
      it(`tiles the viewport without gaps or overlaps (${name}, seed ${seed})`, () => {
        const rng = createRng(seed);
        const fracture = buildFracture({
          width,
          height,
          origin,
          spreadMs: 1500,
          holdMs: 1000,
          rng,
        });
        expect(fracture.shards.length).toBeGreaterThan(20);

        const sample = createRng(seed + 1000);
        for (let n = 0; n < 3000; n++) {
          const p: Point = [sample() * width, sample() * height];
          const hits = fracture.shards.filter((s) => pointInPolygon(p, s.polygon)).length;
          const nearCore =
            Math.hypot(p[0] - origin[0], p[1] - origin[1]) < fracture.coreRadius * 1.5;
          if (nearCore) expect(hits).toBeLessThanOrEqual(1);
          else expect(hits, `point ${p.join(",")}`).toBe(1);
        }
      });
    }
  }

  it("keeps hairlines inside a single shard and schedules cracks inside the timeline", () => {
    const fracture = buildFracture({
      width: 390,
      height: 844,
      origin: [195, 230],
      spreadMs: 1500,
      holdMs: 1000,
      rng: createRng(3),
    });
    for (const crack of fracture.cracks) {
      const end = crack.start + crack.duration;
      if (crack.kind === "hairline") {
        expect(end).toBeLessThanOrEqual(1500 + 1000 + 250);
        const owner = fracture.shards.find((s) => pointInPolygon(crack.points[0], s.polygon));
        expect(owner).toBeDefined();
        for (const p of crack.points) expect(pointInPolygon(p, owner!.polygon)).toBe(true);
      } else {
        expect(end).toBeLessThanOrEqual(1500 + 200);
      }
    }
  });
});
