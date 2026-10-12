// Designs the 10 fixed Net levels and writes app/net/levels.json.
//
//   node scripts/net-levels.mjs            # write levels.json
//   node scripts/net-levels.mjs --report   # print candidate stats only
//
// Each level is a generator recipe plus a difficulty window measured by the
// solver: `waves` (length of the deduction chain) and which global rules the
// player is forced to use. Seeds are fixed, so the output is reproducible and
// editing one level's recipe leaves the others untouched.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRng,
  encodeHex,
  generateLayout,
  scramble,
  solve,
  turnsBetween,
} from "../app/net/engine.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "app/net/levels.json");

/**
 * Every level but the last is a lesson that adds one rule or technique on top
 * of all earlier ones; the last is the real test. `lesson` is what the level
 * teaches (shown before the clock starts), `kind` drives the badge.
 *
 * `waves`: accepted deduction-chain length; the candidate nearest `target`
 * wins. `needs`: global rules the solution must not be reachable without, so
 * a lesson actually exercises what it introduces.
 */
const LEVELS = [
  {
    kind: "lesson",
    name: "通电",
    lesson: "点击格子顺时针旋转 90°。让每个格子都连到电源，就通关了。",
    gen: { w: 3, h: 3, colors: 1, wrap: false, barrierRate: 0.5, sourceGap: 0, minTree: 9 },
    waves: [2, 3, 3],
  },
  {
    kind: "lesson",
    name: "不留线头",
    lesson: "每根线都必须接上邻居的线，不能悬空。棋盘边缘也一样，线不能朝外。",
    gen: { w: 4, h: 4, colors: 1, wrap: false, barrierRate: 0, sourceGap: 0, minTree: 16 },
    waves: [3, 5, 4],
  },
  {
    kind: "lesson",
    name: "墙",
    lesson: "橙色的边是墙，墙那一侧不能有线。墙越多，格子的朝向就越确定。",
    gen: { w: 5, h: 4, colors: 1, wrap: false, barrierRate: 0.3, sourceGap: 0, minTree: 20 },
    waves: [4, 6, 5],
  },
  {
    kind: "lesson",
    name: "锁定",
    lesson: "确定朝向的格子可以长按或右键锁住，锁住后点击不会转，防止误触。锁定不计步数。",
    gen: { w: 5, h: 5, colors: 1, wrap: false, barrierRate: 0.1, sourceGap: 0, minTree: 25 },
    waves: [5, 7, 6],
  },
  {
    kind: "lesson",
    name: "不成环",
    lesson: "网络里不能出现闭合的环路，成环的线会变成红色虚线。",
    gen: { w: 5, h: 5, colors: 1, wrap: false, barrierRate: 0, sourceGap: 0, minTree: 25 },
    waves: [6, 9, 8],
    needs: ["loop"],
  },
  {
    kind: "lesson",
    name: "双电源",
    lesson: "两个电源各带一片网络。两片网络连到一起就会短路，短路的线会闪红。",
    gen: { w: 5, h: 5, colors: 2, wrap: false, barrierRate: 0.15, sourceGap: 4, minTree: 8 },
    waves: [5, 8, 6],
    needs: ["short"],
  },
  {
    kind: "lesson",
    name: "孤岛",
    lesson: "没接到电源的一小片网络永远亮不起来。线只有连上电源才会显示颜色，边界要靠自己推。",
    gen: { w: 6, h: 6, colors: 2, wrap: false, barrierRate: 0, sourceGap: 5, minTree: 12 },
    waves: [8, 12, 10],
    needs: ["sealed"],
  },
  {
    kind: "lesson",
    name: "三分天下",
    lesson: "三个电源，三片网络，任意两片都不能相连。",
    gen: { w: 6, h: 6, colors: 3, wrap: false, barrierRate: 0, sourceGap: 4, minTree: 8 },
    waves: [10, 14, 12],
    needs: ["short", "sealed"],
  },
  {
    kind: "lesson",
    name: "热身",
    lesson: "规则已经全部学完。实战关之前再练一盘。",
    gen: { w: 7, h: 7, colors: 3, wrap: false, barrierRate: 0, sourceGap: 4, minTree: 10 },
    waves: [13, 18, 15],
    needs: ["short", "sealed"],
  },
  {
    kind: "final",
    name: "实战",
    lesson: "没有新东西，用上学过的一切。",
    gen: { w: 8, h: 8, colors: 3, wrap: false, barrierRate: 0, sourceGap: 4, minTree: 12 },
    waves: [18, 30, 22],
    needs: ["loop", "short", "sealed"],
    // Long chains that also resist local matching are rare at this size.
    candidates: 6000,
  },
];

const CANDIDATES = 3000;
const SCRAMBLE_MAX_CORRECT = 0.25;

function design(spec, index) {
  const [lo, hi, target] = spec.waves;
  const rng = createRng(0x5eed + index * 7919);
  let best = null;
  let accepted = 0;
  for (let n = 0; n < (spec.candidates ?? CANDIDATES); n++) {
    const layout = generateLayout(spec.gen, rng);
    if (!layout) continue;
    const { solutions, stats } = solve(layout, layout.solution);
    if (solutions !== 1 || !stats.deducible) continue;
    if (stats.waves < lo || stats.waves > hi) continue;
    if ((spec.needs ?? []).some((rule) => stats.rules[rule] === 0)) continue;
    accepted++;
    // Nearest the target chain length; ties go to fewer tiles given away by
    // the first round of local matching.
    const score = Math.abs(stats.waves - target) + stats.localShare;
    if (!best || score < best.score) best = { layout, stats, score };
  }
  if (!best) throw new Error(`level ${index + 1} (${spec.name}): no candidate in window`);

  const tiles = scramble(best.layout, rng, SCRAMBLE_MAX_CORRECT);
  if (!tiles) throw new Error(`level ${index + 1}: scramble failed`);
  const turns = tiles.reduce((s, v, i) => s + turnsBetween(v, best.layout.solution[i]), 0);
  return { accepted, stats: best.stats, layout: best.layout, tiles, turns };
}

const report = process.argv.includes("--report");
const levels = LEVELS.map((spec, i) => {
  const { accepted, stats, layout, tiles, turns } = design(spec, i);
  const { w, h, wrap, colors } = { ...spec.gen };
  console.log(
    `${String(i + 1).padStart(2)} ${spec.name.padEnd(5, "　")} ${w}x${h}${wrap ? "w" : " "} ` +
      `k${colors} accepted ${String(accepted).padStart(4)}  waves ${String(stats.waves).padStart(2)}  ` +
      `local ${stats.localShare.toFixed(2)}  rules ${JSON.stringify(stats.rules)}  min turns ${turns}`,
  );
  return {
    kind: spec.kind,
    name: spec.name,
    lesson: spec.lesson,
    w,
    h,
    wrap,
    sources: layout.sources,
    barriers: encodeHex(layout.barriers),
    tiles: encodeHex(tiles),
  };
});

if (!report) {
  fs.writeFileSync(outFile, JSON.stringify(levels, null, 2) + "\n");
  console.log(`wrote ${path.relative(root, outFile)}`);
}
