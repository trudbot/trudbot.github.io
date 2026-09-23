import * as THREE from "three";
import { trackClick, trackDisplay } from "@/lib/analytics";
import type { GameContext } from "./context";
import { formatTenths } from "./format";
import type { CircleCollider, Level } from "./level";
import { Sprite } from "./particles";
import { basic, canvasTexture, geo, group, labelFont, mesh, signTexture, stripeTexture, toon } from "./toon";

const CX = 40;
const CZ = 40;
const R2 = Math.SQRT1_2;

/**
 * Course coordinates: `a` runs sideways across the face that looks back at the
 * plaza, `b` runs away from the plaza into the corner. Every platform sits in
 * front of the beanstalk (smaller `b`), so a camera on the town side rarely
 * has the stalk between it and the player.
 */
function world(a: number, b: number): [number, number] {
  return [CX + (a + b) * R2, CZ + (b - a) * R2];
}

/** Rotation that makes a local +Z face point back towards the plaza. */
const FACE_TOWN = -Math.PI * 0.75;

const [ZX, ZZ] = world(0, 3);
/** Keep-out circle for scattered decoration, and the minimap marker. */
export const SKYHOP_ZONE = { x: ZX, z: ZZ, r: 13 };

export const SKYHOP_GOAL = 48;
const SPRING_SPEED = 15;
const LIFT_PERIOD = 9;
const BEST_KEY = "town.skyhop.best";

type Kind = "pillar" | "block" | "leaf" | "cloud" | "spring" | "move" | "lift" | "crumble" | "check";

interface Step {
  kind: Kind;
  a: number;
  b: number;
  /** Height of the standing surface. */
  y: number;
  r?: number;
  /** Movers slide along one course axis by ±amp. */
  axis?: "a" | "b";
  amp?: number;
  /** Lifts travel between `y` and `to`. */
  to?: number;
}

/*
 * Jump budget: a standing jump peaks at ~1.45 m and a walking one covers ~2.4 m,
 * so consecutive platforms rise at most 1 m and sit about 3 m apart centre to
 * centre. The bigger climbs are all springs (≈5 m apex) or lifts.
 */
const ROUTE: Step[] = [
  { kind: "pillar", a: -2.5, b: -4, y: 0.8 },
  { kind: "pillar", a: -5, b: -2.5, y: 1.6 },
  { kind: "leaf", a: -7.5, b: -1, y: 2.4 },
  { kind: "leaf", a: -9, b: 1, y: 3.2 },
  { kind: "spring", a: -7, b: 3, y: 3.6 },
  { kind: "cloud", a: -4.5, b: 3, y: 7.6, r: 1.4 },
  { kind: "check", a: -2, b: 2, y: 8.2 },

  { kind: "block", a: 0.5, b: 1, y: 9.0 },
  { kind: "move", a: 3.5, b: 1, y: 9.6, axis: "b", amp: 1.8 },
  { kind: "leaf", a: 6.5, b: 1.5, y: 10.4 },
  { kind: "leaf", a: 8.5, b: 3, y: 11.2 },
  { kind: "lift", a: 8, b: 5.5, y: 11.2, to: 16 },
  { kind: "cloud", a: 5.5, b: 6, y: 16.6, r: 1.2 },
  { kind: "check", a: 3, b: 5, y: 17.2 },

  { kind: "crumble", a: 0.5, b: 4.5, y: 17.8 },
  { kind: "crumble", a: -2, b: 4, y: 18.4 },
  { kind: "crumble", a: -4.5, b: 3.5, y: 19.0 },
  { kind: "block", a: -7, b: 3, y: 19.8 },
  { kind: "spring", a: -8.5, b: 5, y: 20.2 },
  { kind: "cloud", a: -6, b: 6, y: 24.2, r: 1.4 },
  { kind: "check", a: -3.5, b: 6.5, y: 24.8 },

  { kind: "leaf", a: -0.5, b: 6, y: 25.6 },
  { kind: "move", a: 3, b: 6, y: 26.2, axis: "a", amp: 1.2 },
  { kind: "leaf", a: 6.5, b: 6.5, y: 27 },
  { kind: "block", a: 9, b: 5, y: 27.8 },
  { kind: "crumble", a: 8, b: 2.5, y: 28.6 },
  { kind: "spring", a: 6, b: 1, y: 29.0 },
  { kind: "cloud", a: 3.5, b: 0, y: 33, r: 1.5 },
  { kind: "check", a: 1, b: 0.5, y: 33.6 },

  { kind: "cloud", a: -1.8, b: 1, y: 34.4 },
  { kind: "cloud", a: -4.6, b: 1.5, y: 35.2 },
  { kind: "lift", a: -7, b: 3, y: 35.2, to: 41 },
  { kind: "cloud", a: -5, b: 5, y: 41.6 },
  { kind: "move", a: -2, b: 5.5, y: 42.2, axis: "b", amp: 1.5 },
  { kind: "crumble", a: 0.5, b: 5.5, y: 42.8 },
  { kind: "crumble", a: 3, b: 5, y: 43.4 },
  { kind: "spring", a: 5, b: 6.8, y: 43.8 },
];

const SUMMIT = { a: 0, b: 11, r: 4 };
const START = { a: 1, b: -6.5, r: 2.5, y: 0.25 };

const CANDY = ["#FF8FAB", "#FFD166", "#A78BFA", "#7DD3FC", "#7DFFC7", "#FFA94D"];

function loadBest(): number | null {
  try {
    const v = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function saveBest(t: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(t));
  } catch {
    // Private browsing can refuse storage; the record then lasts for this visit.
  }
}

export function buildSkyHop(level: Level, statics: THREE.Group, ctx: GameContext) {
  const scene = level.scene;
  const checkpoints: Array<{ x: number; y: number; z: number; facing: number }> = [];
  let reached = 0;
  let run: { start: number; assisted: boolean } | null = null;
  let peak = 0;
  let clock = 0;
  let best = loadBest();

  const [padX, padZ] = world(START.a, START.b);
  const [firstX, firstZ] = world(ROUTE[0].a, ROUTE[0].b);
  const padFacing = Math.atan2(firstX - padX, firstZ - padZ);

  // Springs and cookies fire on every contact, so they are counted per climb
  // and reported with its outcome instead of as individual events.
  let springs = 0;
  let crumbles = 0;
  const runTime = () => (run ? Math.round((clock - run.start) * 10) / 10 : null);
  const beginRun = (assisted: boolean) => {
    run = { start: clock, assisted };
    springs = 0;
    crumbles = 0;
  };
  const startRun = () => {
    if (run) return;
    beginRun(false);
    peak = 0;
    trackDisplay("town_hop_start", { assisted: false, best_s: best === null ? null : best / 10 });
  };

  buildBeanstalk(level, statics);
  const checkpointTotal = ROUTE.filter((s) => s.kind === "check").length;

  ROUTE.forEach((s, i) => {
    const [x, z] = world(s.a, s.b);
    const next = ROUTE[i + 1] ?? { a: SUMMIT.a, b: SUMMIT.b };
    const [nx, nz] = world(next.a, next.b);
    const facing = Math.atan2(nx - x, nz - z);
    const color = CANDY[i % CANDY.length];

    switch (s.kind) {
      case "pillar": {
        statics.add(mesh(geo.box(1.6, s.y, 1.6, 0.14), toon(color), { pos: [x, s.y / 2, z] }));
        statics.add(frosting(x, s.y, z, 1.7));
        const c = level.box(x, z, 1.6, 1.6, s.y);
        if (i === 0) c.onStand = startRun;
        break;
      }
      case "block": {
        statics.add(mesh(geo.box(1.7, 0.7, 1.7, 0.14), toon(color), { pos: [x, s.y - 0.35, z] }));
        statics.add(frosting(x, s.y, z, 1.8));
        level.box(x, z, 1.7, 1.7, s.y).oneWay = true;
        break;
      }
      case "leaf": {
        const leaf = group(
          mesh(geo.cyl(1, 0.9, 0.18, 24), toon("#6fcf6a"), { pos: [0, -0.09, 0], scale: [1.15, 1, 0.9] }),
          mesh(geo.box(2.0, 0.05, 0.09, 0.02), toon("#4fae6a"), { pos: [0, 0.01, 0], cast: false }),
          mesh(geo.cone(0.12, 0.7, 6), toon("#4fae6a"), { pos: [-1.35, -0.1, 0], rot: [0, 0, Math.PI / 2] }),
        );
        leaf.position.set(x, s.y, z);
        leaf.rotation.y = facing + 0.5;
        statics.add(leaf);
        level.circle(x, z, 1.0, s.y).oneWay = true;
        break;
      }
      case "cloud": {
        const r = s.r ?? 1.3;
        statics.add(cloudPlatform(x, s.y, z, r, toon("#ffffff")));
        level.circle(x, z, r, s.y).oneWay = true;
        break;
      }
      case "spring":
        buildSpring(level, ctx, x, s.y, z, () => springs++);
        break;
      case "move":
        buildMover(level, x, s.y, z, s.axis ?? "a", s.amp ?? 1.5, i);
        break;
      case "lift":
        buildLift(level, x, s.y, s.to ?? s.y + 4, z, i);
        break;
      case "crumble":
        buildCrumble(level, ctx, x, s.y, z, facing, () => crumbles++);
        break;
      case "check": {
        const n = checkpoints.length + 1;
        checkpoints.push({ x, y: s.y, z, facing });
        const c = buildCheckpoint(level, statics, x, s.y, z, facing, color);
        c.collider.onStand = () => {
          if (n <= reached) return;
          reached = n;
          trackDisplay("town_hop_checkpoint", { checkpoint: n, total: checkpointTotal, height: s.y, time_s: runTime() });
          c.raise();
          ctx.audio.play("checkpoint");
          ctx.toast(`🚩 检查点 ${n} / ${checkpointTotal}`);
        };
        break;
      }
    }
  });

  buildSummit();
  buildStartArea();
  buildSkyClouds(statics);

  level.updaters.push((dt) => {
    clock += dt;
    const p = ctx.playerPosition();
    const near = Math.hypot(p.x - ZX, p.z - ZZ) < SKYHOP_ZONE.r + 3;
    if (run && (!near || p.y < 0.3)) {
      trackDisplay("town_hop_end", {
        result: near ? "fall" : "leave",
        peak: Math.round(peak * 10) / 10,
        checkpoint: reached,
        time_s: runTime(),
        assisted: run.assisted,
        springs,
        crumbles,
      });
      if (near && peak > 4) {
        ctx.toast(reached ? `掉下去啦！起点的云朵可以送你回到检查点 ${reached}` : "掉下去啦！拍拍灰，再来一次～");
      }
      run = null;
    }
    if (run) peak = Math.max(peak, p.y);
    ctx.hud({
      hop: near,
      hopHeight: Math.max(0, Math.round(p.y)),
      hopGoal: SKYHOP_GOAL,
      hopTime: run ? Math.floor((clock - run.start) * 10) : null,
      hopBest: best,
      hopCheckpoint: reached,
      hopCheckpoints: checkpointTotal,
    });
  });

  function finish() {
    if (!run) return;
    const time = Math.floor((clock - run.start) * 10);
    const previousBest = best;
    const pages = [`登顶成功！用时 ${formatTenths(time)}。`];
    if (run.assisted) {
      pages.push("这次是坐云朵从检查点出发的，不计入最佳纪录。试试从地面一口气跳上来？");
    } else if (best === null || time < best) {
      pages.push(best === null ? "这是你的第一个纪录 🏆" : `新纪录！🏆 比之前快了 ${formatTenths(best - time)}。`);
      best = time;
      saveBest(time);
    } else {
      pages.push(`最佳纪录是 ${formatTenths(best)}，再接再厉！`);
    }
    pages.push("云上的风好舒服，整个小镇都在脚下。旁边的彩虹可以一路滑回地面哦。");
    trackDisplay("town_hop_finish", {
      time_s: time / 10,
      assisted: run.assisted,
      new_best: best !== previousBest,
      best_s: best === null ? null : best / 10,
      checkpoint: reached,
      springs,
      crumbles,
    });
    run = null;
    ctx.audio.play("win");
    const p = ctx.playerPosition();
    for (let k = 0; k < 4; k++) {
      level.fx.emit({ pos: { x: p.x, y: p.y + 2, z: p.z }, count: 30, speed: 7, vel: [0, 5, 0], colors: ["#FF8FAB", "#FFD166", "#A78BFA", "#7DD3FC", "#7DFFC7"], size: 0.3, life: 2.5, gravity: 7, drag: 1 });
    }
    ctx.dance(4);
    ctx.say("云端之巅", pages);
  }

  function buildSummit() {
    const [sx, sz] = world(SUMMIT.a, SUMMIT.b);
    statics.add(cloudPlatform(sx, SKYHOP_GOAL, sz, SUMMIT.r, toon("#ffffff")));
    const top = level.circle(sx, sz, SUMMIT.r, SKYHOP_GOAL);
    top.oneWay = true;
    top.onStand = finish;

    const [rx, rz] = world(0, SUMMIT.b + 2);
    const rainbow = group();
    ["#FF6B6B", "#FFA94D", "#FFD166", "#7DFFC7", "#7DD3FC", "#A78BFA"].forEach((c, k) => {
      rainbow.add(mesh(geo.torus(3.2 - k * 0.2, 0.11, Math.PI, 8, 40), toon(c), { cast: k === 0 }));
    });
    rainbow.position.set(rx, SKYHOP_GOAL - 0.1, rz);
    rainbow.rotation.y = FACE_TOWN;
    statics.add(rainbow);

    const [tx, tz] = world(-1.6, SUMMIT.b - 1.8);
    level.addStar("town-sky", tx, SKYHOP_GOAL + 0.9, tz);

    const [gx, gz] = world(-2.6, SUMMIT.b + 0.6);
    const sign = signPost(signTexture("云端之巅", "#E0D4FF", "#14151f", `SKY TOP · ${SKYHOP_GOAL}m`));
    sign.position.set(gx, SKYHOP_GOAL, gz);
    sign.rotation.y = FACE_TOWN + 0.4;
    statics.add(sign);

    const [lx, lz] = world(2.7, SUMMIT.b + 1.3);
    level.interactables.push({
      label: "滑彩虹回到地面",
      radius: 1.9,
      y: SKYHOP_GOAL,
      pos: () => ({ x: lx, z: lz }),
      action: () => {
        trackClick("town_hop_slide");
        ctx.audio.play("whoosh");
        ctx.fadeThrough(() => ctx.teleport(padX, START.y, padZ, padFacing));
      },
    });
  }

  function buildStartArea() {
    const padTex = canvasTexture(512, 512, (c) => {
      c.fillStyle = "#fff4d6";
      c.fillRect(0, 0, 512, 512);
      c.strokeStyle = "#FF8FAB";
      c.lineWidth = 26;
      c.beginPath();
      c.arc(256, 256, 226, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = "#1c1729";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = labelFont(92, 900);
      c.fillText("START", 256, 300);
      c.fillStyle = "#A78BFA";
      c.beginPath();
      c.moveTo(256, 90);
      c.lineTo(336, 200);
      c.lineTo(176, 200);
      c.closePath();
      c.fill();
    });
    statics.add(mesh(geo.cyl(START.r, START.r + 0.1, START.y, 40), toon("#FF8FAB"), { pos: [padX, START.y / 2, padZ] }));
    statics.add(
      mesh(geo.plane(START.r * 1.9, START.r * 1.9), basic("#ffffff", { map: padTex, transparent: true }), {
        pos: [padX, START.y + 0.01, padZ],
        rot: [-Math.PI / 2, 0, FACE_TOWN],
        cast: false,
      }),
    );
    level.circle(padX, padZ, START.r, START.y);

    const postTex = stripeTexture("#ffffff", "#FF6B9D", 6, false);
    postTex.repeat.set(1, 3);
    const postMat = toon("#ffffff", { map: postTex });
    for (const a of [START.a - 2.4, START.a + 2.4]) {
      const [x, z] = world(a, START.b - 3);
      statics.add(mesh(geo.cyl(0.22, 0.26, 3.6, 12), postMat, { pos: [x, 1.8, z] }));
      statics.add(mesh(geo.sphere(0.36, 16, 12), toon("#FFD166"), { pos: [x, 3.75, z] }));
      level.circle(x, z, 0.3);
    }
    const [bx, bz] = world(START.a, START.b - 3);
    const board = group(
      mesh(geo.box(4.4, 1.3, 0.2, 0.1), toon("#A78BFA")),
      mesh(geo.plane(4.2, 1.2), basic("#ffffff", { map: signTexture("云端跳跳乐", "#F5F3FF", "#14151f", `SKY HOP · ${SKYHOP_GOAL}m`), transparent: true }), {
        pos: [0, 0, 0.11],
        cast: false,
      }),
    );
    board.position.set(bx, 3.2, bz);
    board.rotation.y = FACE_TOWN;
    statics.add(board);

    const [ix, iz] = world(START.a + 4.6, START.b - 1.5);
    const info = signPost(signTexture("跳跳乐说明", "#FFEAA7", "#14151f", "HOW TO PLAY"));
    info.position.set(ix, 0, iz);
    info.rotation.y = FACE_TOWN;
    statics.add(info);
    level.circle(ix, iz, 0.3);
    level.interact("看看跳跳乐说明", ix, iz, 1.9, () =>
      ctx.say("云端跳跳乐", [
        `沿着魔豆藤一路往上跳，终点在 ${SKYHOP_GOAL} 米高的云端之巅，那里藏着一颗星星！`,
        "🍄 蘑菇弹簧会把你弹得很高；🍪 饼干踩上去一会儿就会碎掉，别停留；粉色圆盘和紫色云朵会移动，站上去就能跟着走。",
        `途中有 ${checkpointTotal} 面 🚩 旗子。掉下来的话，可以找起点旁边的云朵，直接送你回到最高的检查点。`,
        best === null ? "踩上第一根糖果柱就开始计时，从地面一口气跳到顶会记录最佳成绩。" : `目前的最佳纪录：${formatTenths(best)}。`,
      ]),
    );

    const [ex, ez] = world(START.a - 4.4, START.b - 1.2);
    const lift = group(
      mesh(geo.cyl(0.08, 0.1, 1.5, 8), toon("#8a5a3c"), { pos: [0, 0.75, 0] }),
      cloudPuffs(0.75, toon("#E0D4FF")),
    );
    lift.children[1].position.y = 1.75;
    lift.position.set(ex, 0, ez);
    scene.add(lift);
    level.circle(ex, ez, 0.3);
    level.updaters.push((_, t) => {
      lift.children[1].position.y = 1.75 + Math.sin(t * 2) * 0.12;
    });
    level.interactables.push({
      label: "乘云去检查点",
      radius: 1.9,
      pos: () => ({ x: ex, z: ez }),
      dynamicLabel: () => (reached ? `乘云去检查点 ${reached}` : "乘云去检查点（未解锁）"),
      action: () => {
        if (!reached) {
          trackClick("town_hop_elevator", { checkpoint: 0, locked: true });
          ctx.toast("先靠自己跳到第一面 🚩 旗子那里吧！");
          return;
        }
        const cp = checkpoints[reached - 1];
        trackClick("town_hop_elevator", { checkpoint: reached, height: cp.y });
        ctx.audio.play("whoosh");
        ctx.fadeThrough(() => {
          ctx.teleport(cp.x, cp.y, cp.z, cp.facing);
          beginRun(true);
          peak = cp.y;
          trackDisplay("town_hop_start", { assisted: true, checkpoint: reached });
        });
      },
    });
  }
}

// ─── Platform builders ──────────────────────────────────────────────────────

function frosting(x: number, top: number, z: number, w: number) {
  const white = toon("#fffaf0");
  const g = group(mesh(geo.box(w, 0.22, w, 0.1), white, { pos: [0, -0.09, 0] }));
  for (let k = 0; k < 8; k++) {
    const side = k % 4;
    const along = (k < 4 ? -0.25 : 0.3) * w;
    const [dx, dz] = side === 0 ? [along, w / 2] : side === 1 ? [w / 2, along] : side === 2 ? [along, -w / 2] : [-w / 2, along];
    g.add(mesh(geo.capsule(0.09, 0.16 + (k % 3) * 0.08), white, { pos: [dx, -0.28 - (k % 3) * 0.04, dz], cast: false }));
  }
  g.position.set(x, top, z);
  return g;
}

/** Fluffy rim around a flat disc; the disc top sits at the group origin. */
function cloudPuffs(r: number, mat: THREE.Material) {
  const g = group(mesh(geo.cyl(r, r * 0.85, 0.34, 28), mat, { pos: [0, -0.17, 0] }));
  const n = Math.max(6, Math.round(r * 5));
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2;
    const pr = r * (k % 2 ? 0.36 : 0.44);
    g.add(mesh(geo.sphere(1, 14, 10), mat, { pos: [Math.cos(ang) * r * 0.86, -0.28, Math.sin(ang) * r * 0.86], scale: [pr, pr * 0.8, pr] }));
  }
  g.add(mesh(geo.sphere(1, 16, 10), mat, { pos: [0, -0.45, 0], scale: [r * 0.75, r * 0.35, r * 0.75] }));
  return g;
}

function cloudPlatform(x: number, y: number, z: number, r: number, mat: THREE.Material) {
  const g = cloudPuffs(r, mat);
  g.position.set(x, y, z);
  return g;
}

function buildSpring(level: Level, ctx: GameContext, x: number, y: number, z: number, onUse: () => void) {
  const cap = group(mesh(geo.custom("springCap", () => new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon("#FF6B6B"), { scale: [0.95, 0.42, 0.95] }));
  for (let k = 0; k < 5; k++) {
    const ang = (k / 5) * Math.PI * 2;
    cap.add(mesh(geo.sphere(0.13, 10, 8), toon("#ffffff"), { pos: [Math.cos(ang) * 0.55, 0.3, Math.sin(ang) * 0.55], scale: [1, 0.45, 1], cast: false }));
  }
  const coil = group();
  for (let k = 0; k < 3; k++) {
    coil.add(mesh(geo.torus(0.42, 0.07, Math.PI * 2, 8, 20), toon("#c9c4d9"), { pos: [0, 0.08 + k * 0.14, 0], rot: [Math.PI / 2, 0, 0] }));
  }
  const base = mesh(geo.cyl(0.85, 0.95, 0.3, 24), toon("#4a4e69"), { pos: [0, -0.15, 0] });
  const spring = group(base, coil, cap);
  spring.position.set(x, y - 0.8, z);
  level.scene.add(spring);

  let squash = 0;
  const c = level.circle(x, z, 0.95, y);
  c.oneWay = true;
  c.onStand = () => {
    onUse();
    ctx.launch(SPRING_SPEED);
    ctx.audio.play("spring");
    squash = 1;
    level.glow.emit({ pos: { x, y: y + 0.2, z }, count: 14, spread: 0.6, speed: 3, vel: [0, 2, 0], colors: ["#FFD166", "#FF8FAB"], size: 0.3, life: 0.7, drag: 2, sprite: Sprite.Star });
  };
  level.updaters.push((dt, t) => {
    squash = Math.max(0, squash - dt * 2.2);
    const wobble = squash * Math.sin((1 - squash) * 22);
    coil.scale.y = 1 + wobble * 0.6;
    cap.position.y = 0.4 + wobble * 0.25 + Math.sin(t * 3 + x) * 0.02;
  });
}

function carrying(c: CircleCollider) {
  const carry = { x: 0, y: 0, z: 0 };
  c.oneWay = true;
  c.carry = carry;
  return carry;
}

function buildMover(level: Level, x: number, y: number, z: number, axis: "a" | "b", amp: number, seed: number) {
  const tex = stripeTexture("#FF8FAB", "#fffaf0", 12);
  const disc = group(
    mesh(geo.cyl(1.1, 1.0, 0.36, 28), toon("#ffffff", { map: tex }), { pos: [0, -0.18, 0] }),
    mesh(geo.torus(1.06, 0.08, Math.PI * 2, 8, 36), toon("#FFD166"), { pos: [0, -0.02, 0], rot: [Math.PI / 2, 0, 0] }),
    mesh(geo.sphere(0.22, 14, 10), toon("#FF6B9D"), { pos: [0, -0.4, 0], scale: [1, 0.6, 1] }),
  );
  disc.rotation.y = axis === "a" ? FACE_TOWN : FACE_TOWN + Math.PI / 2;
  level.scene.add(disc);
  const [dx, dz] = axis === "a" ? [R2, -R2] : [R2, R2];
  const offsetAt = (t: number) => Math.sin(t * 0.9 + seed) * amp;
  const c = level.circle(x + dx * offsetAt(0), z + dz * offsetAt(0), 1.1, y);
  const carry = carrying(c);
  disc.position.set(c.x, y, c.z);
  level.updaters.push((_, t) => {
    const off = offsetAt(t);
    const px = x + dx * off;
    const pz = z + dz * off;
    carry.x = px - c.x;
    carry.z = pz - c.z;
    c.x = px;
    c.z = pz;
    disc.position.set(px, y, pz);
  });
}

function buildLift(level: Level, x: number, y0: number, y1: number, z: number, seed: number) {
  const lift = cloudPuffs(1.3, toon("#E0D4FF"));
  for (const side of [-1, 1]) {
    lift.add(mesh(geo.sphere(0.35, 12, 8), toon("#ffffff"), { pos: [side * 1.35, -0.1, 0], scale: [0.5, 1, 1.6], rot: [0, 0, side * 0.5] }));
  }
  lift.position.set(x, y0, z);
  level.scene.add(lift);
  const c = level.circle(x, z, 1.3, y0);
  const carry = carrying(c);
  level.updaters.push((_, t) => {
    // Smoothstep over the middle of the cosine cycle leaves a pause at each end for boarding.
    const k = THREE.MathUtils.smoothstep(0.5 - 0.5 * Math.cos((t / LIFT_PERIOD) * Math.PI * 2 + seed), 0.15, 0.85);
    const y = y0 + (y1 - y0) * k;
    carry.y = y - c.top;
    c.top = y;
    lift.position.y = y;
    lift.rotation.y = Math.sin(t * 0.7 + seed) * 0.3;
  });
}

function buildCrumble(level: Level, ctx: GameContext, x: number, y: number, z: number, facing: number, onUse: () => void) {
  const cookie = group(mesh(geo.cyl(1.0, 1.0, 0.36, 28), toon("#d9a066"), { pos: [0, -0.18, 0] }));
  cookie.add(mesh(geo.cyl(0.92, 0.92, 0.04, 28), toon("#e8b87a", { outline: false }), { pos: [0, 0.005, 0], cast: false }));
  for (let k = 0; k < 7; k++) {
    const ang = k * 2.4;
    const d = 0.25 + (k % 3) * 0.22;
    cookie.add(mesh(geo.sphere(0.1, 8, 6), toon("#5b3a29"), { pos: [Math.cos(ang) * d, 0.02, Math.sin(ang) * d], scale: [1, 0.5, 1], cast: false }));
  }
  cookie.position.set(x, y, z);
  cookie.rotation.y = facing;
  level.scene.add(cookie);

  const c = level.circle(x, z, 1.0, y);
  c.oneWay = true;
  let state: "idle" | "shaking" | "gone" = "idle";
  let timer = 0;
  let fall = 0;
  c.onStand = () => {
    if (state !== "idle") return;
    state = "shaking";
    timer = 0.55;
    onUse();
    ctx.audio.play("crumble");
  };
  level.updaters.push((dt, t) => {
    if (state === "shaking") {
      timer -= dt;
      cookie.position.set(x + Math.sin(t * 70) * 0.05, y, z + Math.cos(t * 63) * 0.05);
      if (timer <= 0) {
        state = "gone";
        timer = 3;
        fall = 0;
        c.off = true;
        level.fx.emit({ pos: { x, y: y - 0.1, z }, count: 18, spread: 0.9, speed: 1.5, colors: ["#d9a066", "#b07a4f", "#e8b87a"], size: 0.3, life: 0.9, gravity: 12 });
      }
    } else if (state === "gone") {
      timer -= dt;
      fall += 16 * dt;
      cookie.position.y -= fall * dt;
      cookie.rotation.x += dt * 2.5;
      cookie.scale.setScalar(Math.max(0.01, cookie.scale.x - dt * 0.6));
      if (timer <= 0) {
        state = "idle";
        c.off = false;
        cookie.position.set(x, y, z);
        cookie.rotation.set(0, facing, 0);
        cookie.scale.setScalar(0.01);
      }
    } else if (cookie.scale.x < 1) {
      cookie.scale.setScalar(Math.min(1, cookie.scale.x + dt * 3));
    }
  });
}

function buildCheckpoint(level: Level, statics: THREE.Group, x: number, y: number, z: number, facing: number, color: string) {
  statics.add(
    group(
      mesh(geo.cyl(1.3, 1.15, 0.42, 30), toon("#fffaf0"), { pos: [0, -0.21, 0] }),
      mesh(geo.torus(1.26, 0.09, Math.PI * 2, 8, 36), toon(color), { pos: [0, -0.04, 0], rot: [Math.PI / 2, 0, 0] }),
    ).translateX(x).translateY(y).translateZ(z),
  );
  const flagMat = toon("#c9c4d9", { unique: true, emissive: "#FF6B9D", emissiveIntensity: 0 });
  const flag = mesh(
    geo.custom("pennant", () => {
      const s = new THREE.Shape([new THREE.Vector2(0, 0.28), new THREE.Vector2(0.8, 0), new THREE.Vector2(0, -0.28)]);
      return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
    }),
    flagMat,
  );
  const pole = group(mesh(geo.cyl(0.05, 0.05, 2.3, 8), toon("#4a4e69"), { pos: [0, 1.15, 0] }), mesh(geo.sphere(0.1, 10, 8), toon("#FFD166"), { pos: [0, 2.35, 0] }), flag);
  flag.position.set(0.04, 0.9, 0);
  const side = facing + Math.PI / 2;
  pole.position.set(x + Math.sin(side) * 0.95, y, z + Math.cos(side) * 0.95);
  level.scene.add(pole);

  let raised = 0;
  let up = false;
  level.updaters.push((dt, t) => {
    if (up && raised < 1) raised = Math.min(1, raised + dt * 1.8);
    flag.position.y = 0.9 + raised * 1.15;
    flag.rotation.y = Math.sin(t * 3 + x) * 0.25;
  });

  const collider = level.circle(x, z, 1.3, y);
  collider.oneWay = true;
  return {
    collider,
    raise() {
      up = true;
      flagMat.color.set("#FF6B9D");
      flagMat.emissiveIntensity = 0.35;
      level.glow.emit({ pos: { x, y: y + 1.6, z }, count: 26, spread: 0.8, speed: 3, colors: ["#FF8FAB", "#FFD166", "#ffffff"], size: 0.3, life: 1, drag: 2, sprite: Sprite.Star });
    },
  };
}

// ─── Scenery ────────────────────────────────────────────────────────────────

function signPost(tex: THREE.Texture) {
  return group(
    mesh(geo.cyl(0.1, 0.12, 2.4, 8), toon("#8a5a3c"), { pos: [0, 1.2, 0] }),
    mesh(geo.box(2.4, 0.85, 0.14, 0.08), toon("#FFD166"), { pos: [0, 2.2, 0] }),
    mesh(geo.plane(2.25, 0.72), basic("#ffffff", { map: tex, transparent: true }), { pos: [0, 2.2, 0.08], cast: false }),
  );
}

function buildBeanstalk(level: Level, statics: THREE.Group) {
  const n = 14;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const [x, z] = world(Math.sin(i * 0.9) * 0.7, 9 + k * 2.3 + Math.cos(i * 0.9) * 0.5);
    pts.push(new THREE.Vector3(x, -0.5 + k * (SKYHOP_GOAL + 1.8), z));
    // Solid all the way up so the character can't walk through it at any height.
    level.circle(x, z, 0.95);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  statics.add(mesh(new THREE.TubeGeometry(curve, 200, 0.85, 12), toon("#5bbf4a")));

  const vine: THREE.Vector3[] = [];
  for (let j = 0; j <= 160; j++) {
    const p = curve.getPointAt(j / 160);
    const ang = j * 0.45;
    vine.push(new THREE.Vector3(p.x + Math.cos(ang) * 0.9, p.y, p.z + Math.sin(ang) * 0.9));
  }
  statics.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vine), 600, 0.16, 6), toon("#8ee07a")));

  const leafMat = toon("#6fcf6a");
  for (let j = 1; j < 16; j++) {
    const p = curve.getPointAt(j / 16.5);
    const ang = j * 2.2;
    statics.add(
      mesh(geo.sphere(1, 16, 8), leafMat, {
        pos: [p.x + Math.cos(ang) * 1.7, p.y, p.z + Math.sin(ang) * 1.7],
        rot: [0, -ang, 0.3],
        scale: [1.3, 0.1, 0.65],
      }),
    );
  }
  const tip = curve.getPointAt(1);
  statics.add(mesh(geo.torus(0.45, 0.2, Math.PI * 1.5, 8, 20), toon("#5bbf4a"), { pos: [tip.x, tip.y + 0.3, tip.z], rot: [0, FACE_TOWN, 0] }));
}

function buildSkyClouds(statics: THREE.Group) {
  const white = toon("#ffffff");
  const [sx, sz] = world(SUMMIT.a, SUMMIT.b);
  // Only the half of the sky behind the summit, so none drift over the route.
  for (let k = 0; k < 7; k++) {
    const ang = -Math.PI / 4 + (k / 6) * Math.PI;
    const d = 8 + (k % 3) * 2;
    const c = group();
    for (let m = 0; m < 4; m++) {
      const r = 1.4 + ((k + m) % 3) * 0.5;
      c.add(mesh(geo.sphere(1, 14, 10), white, { pos: [m * 1.8 - 2.7, (m % 2) * 0.5, (m % 3) * 0.6], scale: [r, r * 0.75, r], cast: false }));
    }
    c.position.set(sx + Math.cos(ang) * d, SKYHOP_GOAL - 5 + (k % 4) * 1.6, sz + Math.sin(ang) * d);
    c.rotation.y = ang;
    statics.add(c);
  }
}
