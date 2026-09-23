import * as THREE from "three";
import { HOUSES, type GameContext, type HouseId } from "./context";
import { Level, SOLID } from "./level";
import { Sprite } from "./particles";
import { basic, canvasTexture, geo, group, labelFont, mergeStatic, mesh, toon } from "./toon";

const RW = 14;
const RD = 11;
const RH = 4;
const PALETTE = ["#FF8FAB", "#FFD166", "#A78BFA", "#7DD3FC", "#FFA94D", "#5CE0D8", "#7DFFC7", "#FF6B9D"];

type Side = "north" | "south" | "east" | "west";

interface Room {
  level: Level;
  statics: THREE.Group;
  decor: Record<Side, THREE.Group>;
  sky: THREE.MeshToonMaterial;
  ctx: GameContext;
  name: string;
}

// ─── Textures ───────────────────────────────────────────────────────────────

function repeat(tex: THREE.Texture, x: number, y: number) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(x, y);
  return tex;
}

function planks(base: string, seam: string) {
  return repeat(
    canvasTexture(256, 256, (c) => {
      c.fillStyle = base;
      c.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 8; row++) {
        c.fillStyle = row % 2 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
        c.fillRect(0, row * 32, 256, 32);
        c.fillStyle = seam;
        c.fillRect(0, row * 32, 256, 3);
        const off = (row * 97) % 256;
        c.fillRect(off, row * 32, 3, 32);
        c.fillRect((off + 128) % 256, row * 32, 3, 32);
      }
    }),
    3,
    3,
  );
}

function checker(a: string, b: string) {
  return repeat(
    canvasTexture(128, 128, (c) => {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          c.fillStyle = (x + y) % 2 ? a : b;
          c.fillRect(x * 32, y * 32, 32, 32);
        }
      }
    }),
    5,
    4,
  );
}

function wallpaper(bg: string, fg: string, kind: "dots" | "stripes" | "stars") {
  return repeat(
    canvasTexture(128, 128, (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = fg;
      if (kind === "stripes") {
        for (let x = 0; x < 128; x += 32) c.fillRect(x, 0, 14, 128);
      } else if (kind === "dots") {
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            c.beginPath();
            c.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5, 0, Math.PI * 2);
            c.fill();
          }
        }
      } else {
        for (let i = 0; i < 18; i++) {
          const x = (i * 53) % 128;
          const y = (i * 37) % 128;
          c.globalAlpha = 0.4 + ((i * 7) % 5) / 8;
          c.fillRect(x, y, i % 4 === 0 ? 4 : 2, i % 4 === 0 ? 4 : 2);
        }
      }
    }),
    6,
    2,
  );
}

function textPanel(lines: string[], bg: string, fg: string, w = 512, h = 384, size = 44) {
  return canvasTexture(w, h, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = fg;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const lh = h / (lines.length + 1);
    lines.forEach((line, i) => {
      c.font = labelFont(i === 0 ? size * 1.2 : size, i === 0 ? 900 : 700);
      c.fillText(line, w / 2, lh * (i + 1), w - 40);
    });
  });
}

// ─── Room shell ─────────────────────────────────────────────────────────────

interface RoomStyle {
  floor: THREE.Texture;
  wall: THREE.Texture | string;
  wainscot: string;
  trim: string;
  bg: string;
  lamp?: string;
}

function makeRoom(id: HouseId, ctx: GameContext, style: RoomStyle): Room {
  const def = HOUSES.find((h) => h.id === id)!;
  const level = new Level({
    id,
    name: def.name,
    indoor: true,
    bounds: { minX: -RW / 2 + 0.45, maxX: RW / 2 - 0.45, minZ: -RD / 2 + 0.45, maxZ: RD / 2 - 0.45 },
    spawn: { x: 0, z: RD / 2 - 2.4, facing: Math.PI },
    camera: { distance: 10.5, minDistance: 5, maxDistance: 14, pitch: 0.78, yaw: 0 },
  });
  const scene = level.scene;
  scene.background = new THREE.Color(style.bg);
  const statics = new THREE.Group();
  scene.add(statics);

  scene.add(new THREE.HemisphereLight("#fff6e8", "#e8d5c0", 1.45));
  const sun = new THREE.DirectionalLight("#fff1dc", 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -11;
  sc.right = sc.top = 11;
  sc.near = 1;
  sc.far = 40;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  level.sun = sun;
  level.sunOffset.set(3, 12, 7);
  const bulb = new THREE.PointLight(style.lamp ?? "#ffd9a0", 14, 18, 1.4);
  bulb.position.set(0, 3.6, 0);
  scene.add(bulb);

  statics.add(mesh(geo.box(RW + 0.6, 0.2, RD + 0.6, 0.05), toon("#ffffff", { map: style.floor, outline: false }), { pos: [0, -0.1, 0], cast: false }));
  statics.add(mesh(geo.box(RW + 3, 0.3, RD + 3, 0.1), toon(style.trim), { pos: [0, -0.3, 0], cast: false }));

  const wallMat = typeof style.wall === "string" ? toon(style.wall) : toon("#ffffff", { map: style.wall });
  const wainscot = toon(style.wainscot);
  const trim = toon(style.trim);
  const sides: Array<[Side, number, number, number, number, number]> = [
    ["north", 0, -RD / 2 - 0.15, RW + 0.6, 0, -1],
    ["south", 0, RD / 2 + 0.15, RW + 0.6, 0, 1],
    ["east", RW / 2 + 0.15, 0, RD, 1, 0],
    ["west", -RW / 2 - 0.15, 0, RD, -1, 0],
  ];
  const decor = {} as Record<Side, THREE.Group>;
  for (const [side, x, z, len, nx, nz] of sides) {
    const alongX = nz !== 0;
    const wall = new THREE.Group();
    wall.userData.keep = true;
    wall.add(mesh(alongX ? geo.box(len, RH, 0.3, 0.06) : geo.box(0.3, RH, len, 0.06), wallMat, { pos: [x, RH / 2, z] }));
    const inset = 0.17;
    wall.add(
      mesh(alongX ? geo.box(len - 0.3, 1.2, 0.06, 0.02) : geo.box(0.06, 1.2, len - 0.3, 0.02), wainscot, {
        pos: [x - nx * inset, 0.6, z - nz * inset],
      }),
    );
    wall.add(mesh(alongX ? geo.box(len, 0.14, 0.42, 0.04) : geo.box(0.42, 0.14, len, 0.04), trim, { pos: [x, RH, z] }));
    scene.add(wall);
    const d = new THREE.Group();
    d.userData.keep = true;
    scene.add(d);
    decor[side] = d;
    level.cutaways.push({ wall, decor: d, nx, nz, px: x, pz: z });
  }

  const sky = toon("#bfe9ff", { emissive: "#bfe9ff", emissiveIntensity: 0.5, unique: true });
  level.nightHandlers.push((k) => {
    sky.color.set("#bfe9ff").lerp(new THREE.Color("#1b2150"), k);
    sky.emissive.set("#bfe9ff").lerp(new THREE.Color("#2a2f70"), k);
    bulb.intensity = THREE.MathUtils.lerp(14, 22, k);
  });

  // Exit mat by the (cut-away) front door.
  const matTex = canvasTexture(256, 128, (c) => {
    c.fillStyle = "#c0553f";
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = "#fbe2c8";
    c.lineWidth = 8;
    c.strokeRect(10, 10, 236, 108);
    c.fillStyle = "#fbe2c8";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = labelFont(46, 900);
    c.fillText("出口 EXIT", 128, 66);
  });
  statics.add(mesh(geo.box(2.4, 0.05, 1.2, 0.02), toon("#ffffff", { map: matTex, outline: false }), { pos: [0, 0.02, RD / 2 - 0.8], cast: false }));
  decor.south.add(mesh(geo.box(1.6, 2.5, 0.12, 0.05), toon(def.door), { pos: [0, 1.25, RD / 2 - 0.05] }));
  level.interact(`离开 ${def.name}`, 0, RD / 2 - 0.8, 1.3, () => ctx.exitHouse());

  return { level, statics, decor, sky, ctx, name: def.name };
}

function windowOn(room: Room, side: Side, u: number, y = 2.3, w = 1.8, h = 1.5) {
  const white = toon("#fffaf0");
  const g = group(
    mesh(geo.box(w, h, 0.12, 0.05), white),
    mesh(geo.box(w - 0.3, h - 0.3, 0.06, 0.02), room.sky, { pos: [0, 0, 0.05] }),
    mesh(geo.box(0.07, h - 0.3, 0.05, 0.02), white, { pos: [0, 0, 0.09] }),
    mesh(geo.box(w - 0.3, 0.07, 0.05, 0.02), white, { pos: [0, 0, 0.09] }),
    mesh(geo.box(w + 0.2, 0.1, 0.3, 0.03), white, { pos: [0, -h / 2, 0.12] }),
  );
  placeOnWall(g, side, u, y);
  room.decor[side].add(g);
}

/** Positions an object flush against the inside face of a wall, facing into the room. */
function placeOnWall(obj: THREE.Object3D, side: Side, u: number, y: number, depth = 0) {
  const inX = RW / 2 - 0.02 - depth;
  const inZ = RD / 2 - 0.02 - depth;
  if (side === "north") obj.position.set(u, y, -inZ);
  else if (side === "south") {
    obj.position.set(u, y, inZ);
    obj.rotation.y = Math.PI;
  } else if (side === "east") {
    obj.position.set(inX, y, u);
    obj.rotation.y = -Math.PI / 2;
  } else {
    obj.position.set(-inX, y, u);
    obj.rotation.y = Math.PI / 2;
  }
}

function poster(room: Room, side: Side, u: number, y: number, tex: THREE.Texture, w: number, h: number, frame = "#3b3f5c") {
  const g = group(
    mesh(geo.box(w + 0.16, h + 0.16, 0.08, 0.03), toon(frame)),
    mesh(geo.plane(w, h), basic("#ffffff", { map: tex }), { pos: [0, 0, 0.05], cast: false }),
  );
  placeOnWall(g, side, u, y);
  room.decor[side].add(g);
}

// ─── Furniture ──────────────────────────────────────────────────────────────

function place(obj: THREE.Object3D, x: number, z: number, ry = 0) {
  obj.position.set(x, 0, z);
  obj.rotation.y = ry;
  return obj;
}

function rug(room: Room, x: number, z: number, r: number, color: string, ring: string) {
  room.statics.add(mesh(geo.cyl(r, r, 0.03, 40), toon(ring, { outline: false }), { pos: [x, 0.015, z], cast: false }));
  room.statics.add(mesh(geo.cyl(r * 0.82, r * 0.82, 0.035, 40), toon(color, { outline: false }), { pos: [x, 0.02, z], cast: false }));
}

function roundTable(room: Room, x: number, z: number, color: string, r = 0.8, h = 0.8) {
  const t = group(
    mesh(geo.cyl(r, r, 0.1, 24), toon(color), { pos: [0, h, 0] }),
    mesh(geo.cyl(0.08, 0.1, h, 10), toon("#3b3f5c"), { pos: [0, h / 2, 0] }),
    mesh(geo.cyl(0.4, 0.45, 0.06, 16), toon("#3b3f5c"), { pos: [0, 0.03, 0] }),
  );
  room.statics.add(place(t, x, z));
  room.level.circle(x, z, r, h + 0.05);
}

function chair(room: Room, x: number, z: number, ry: number, color: string) {
  const c = group(
    mesh(geo.box(0.55, 0.1, 0.55, 0.04), toon(color), { pos: [0, 0.48, 0] }),
    mesh(geo.box(0.55, 0.6, 0.08, 0.04), toon(color), { pos: [0, 0.8, -0.24] }),
  );
  for (const [lx, lz] of [
    [0.22, 0.22],
    [-0.22, 0.22],
    [0.22, -0.22],
    [-0.22, -0.22],
  ]) {
    c.add(mesh(geo.cyl(0.03, 0.03, 0.46, 6), toon("#3b3f5c"), { pos: [lx, 0.23, lz] }));
  }
  room.statics.add(place(c, x, z, ry));
  room.level.circle(x, z, 0.3, 0.53);
}

function plant(room: Room, x: number, z: number, s = 1) {
  const p = group(
    mesh(geo.cyl(0.3, 0.22, 0.5, 14), toon("#e07a5f"), { pos: [0, 0.25, 0] }),
    mesh(geo.sphere(0.42, 14, 10), toon("#5bbf73"), { pos: [0, 0.8, 0] }),
    mesh(geo.sphere(0.3, 14, 10), toon("#6fcf6a"), { pos: [0.22, 1.05, 0.1] }),
    mesh(geo.sphere(0.28, 14, 10), toon("#4fae6a"), { pos: [-0.2, 1.1, -0.1] }),
  );
  p.scale.setScalar(s);
  room.statics.add(place(p, x, z));
  room.level.circle(x, z, 0.35 * s);
}

function booksTexture(seed: number) {
  return canvasTexture(256, 256, (c) => {
    c.fillStyle = "#6b4630";
    c.fillRect(0, 0, 256, 256);
    let r = seed;
    const next = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    for (let row = 0; row < 4; row++) {
      let x = 8;
      const baseY = row * 64 + 60;
      while (x < 248) {
        const w = 8 + next() * 12;
        const h = 36 + next() * 18;
        c.fillStyle = PALETTE[Math.floor(next() * PALETTE.length)];
        c.fillRect(x, baseY - h, w - 2, h);
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.fillRect(x + 2, baseY - h + 6, w - 6, 3);
        x += w;
      }
      c.fillStyle = "#4a2f20";
      c.fillRect(0, baseY, 256, 6);
    }
  });
}

function bookshelf(room: Room, side: Side, u: number, w = 2.4, h = 3, seed = 1) {
  const g = group(
    mesh(geo.box(w, h, 0.6, 0.06), toon("#8a5a3c"), { pos: [0, h / 2, 0.3] }),
    mesh(geo.plane(w - 0.2, h - 0.2), toon("#ffffff", { map: booksTexture(seed), outline: false }), { pos: [0, h / 2, 0.61], cast: false }),
  );
  placeOnWall(g, side, u, 0);
  room.statics.add(g);
  room.level.colliderFrom(g, SOLID);
  return g;
}

function counter(room: Room, x: number, z: number, w: number, d: number, h: number, body: string, topColor: string) {
  const c = group(
    mesh(geo.box(w, h - 0.1, d, 0.06), toon(body), { pos: [0, (h - 0.1) / 2, 0] }),
    mesh(geo.box(w + 0.15, 0.12, d + 0.15, 0.04), toon(topColor), { pos: [0, h - 0.06, 0] }),
  );
  room.statics.add(place(c, x, z));
  room.level.box(x, z, w + 0.15, d + 0.15, h);
  return c;
}

function spinner(room: Room, obj: THREE.Object3D, speed: number) {
  obj.userData.keep = true;
  room.level.scene.add(obj);
  room.level.updaters.push((dt) => {
    obj.rotation.y += dt * speed;
  });
}

function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)];
}

// ─── Rooms ──────────────────────────────────────────────────────────────────

function home(ctx: GameContext) {
  const room = makeRoom("home", ctx, {
    floor: planks("#e6b98a", "#c9956a"),
    wall: wallpaper("#d9f7f1", "#b5ebe0", "dots"),
    wainscot: "#9fe3d6",
    trim: "#FF8FAB",
    bg: "#2c2a4a",
  });
  const { level, statics } = room;
  windowOn(room, "north", -2.5);
  windowOn(room, "north", 2.5);
  windowOn(room, "west", 1);
  rug(room, 0, 0, 2.4, "#FFC4D6", "#FF8FAB");

  const bed = group(
    mesh(geo.box(2.2, 0.45, 3.2, 0.1), toon("#c98a5a"), { pos: [0, 0.25, 0] }),
    mesh(geo.box(2.05, 0.25, 3.0, 0.12), toon("#ffffff"), { pos: [0, 0.55, 0] }),
    mesh(geo.box(2.1, 0.18, 2.0, 0.08), toon("#7DD3FC"), { pos: [0, 0.68, 0.5] }),
    mesh(geo.box(0.9, 0.22, 0.5, 0.1), toon("#FFEAA7"), { pos: [-0.5, 0.75, -1.1] }),
    mesh(geo.box(0.9, 0.22, 0.5, 0.1), toon("#FFEAA7"), { pos: [0.5, 0.75, -1.1] }),
    mesh(geo.box(2.2, 1.3, 0.16, 0.08), toon("#c98a5a"), { pos: [0, 0.65, -1.62] }),
  );
  statics.add(place(bed, -4.6, -3.4));
  level.box(-4.6, -3.4, 2.2, 3.3, 0.72);
  level.addStar("house-home", -4.6, 1.6, -3.2);
  level.interact("睡一觉", -4.6, -1.6, 1.4, () => {
    const toNight = !ctx.isNight();
    ctx.fadeThrough(() => {
      ctx.setNight(toNight);
      ctx.say("呼……", [toNight ? "一觉醒来，窗外已经是星星点点的夜晚了。" : "睡了个好觉！窗外阳光正好，新的一天开始了。"]);
    });
  });

  const nightstand = group(
    mesh(geo.box(0.7, 0.7, 0.6, 0.06), toon("#FFA94D"), { pos: [0, 0.35, 0] }),
    mesh(geo.cyl(0.12, 0.2, 0.35, 12), toon("#fff4c9", { emissive: "#ffd27a", emissiveIntensity: 0.6 }), { pos: [0, 0.95, 0] }),
  );
  statics.add(place(nightstand, -2.9, -4.6));
  level.box(-2.9, -4.6, 0.7, 0.6, SOLID);

  const screen = textPanel(["trudbot here!", "blog.trudbot.cn", "github.com/trudbot"], "#1c1d3a", "#7DFFC7", 512, 320, 46);
  const desk = group(
    mesh(geo.box(2.4, 0.1, 1.1, 0.04), toon("#f3e3bf"), { pos: [0, 0.85, 0] }),
    mesh(geo.box(0.1, 0.8, 1.0, 0.03), toon("#c9956a"), { pos: [-1.1, 0.4, 0] }),
    mesh(geo.box(0.1, 0.8, 1.0, 0.03), toon("#c9956a"), { pos: [1.1, 0.4, 0] }),
    mesh(geo.box(1.3, 0.85, 0.08, 0.04), toon("#3b3f5c"), { pos: [0, 1.5, -0.25] }),
    mesh(geo.plane(1.18, 0.72), basic("#ffffff", { map: screen }), { pos: [0, 1.5, -0.2], cast: false }),
    mesh(geo.box(0.12, 0.3, 0.12, 0.03), toon("#3b3f5c"), { pos: [0, 1.0, -0.28] }),
    mesh(geo.box(0.8, 0.04, 0.3, 0.02), toon("#ffffff"), { pos: [0, 0.92, 0.2] }),
    mesh(geo.cyl(0.08, 0.07, 0.18, 12), toon("#FF8FAB"), { pos: [0.85, 1.0, 0.1] }),
  );
  statics.add(place(desk, 4.2, -4.6));
  level.box(4.2, -4.6, 2.4, 1.1, SOLID);
  chair(room, 4.2, -3.5, Math.PI, "#7DD3FC");
  level.interact("看看电脑", 4.2, -3.3, 1.5, () =>
    ctx.say("电脑屏幕", [
      "屏幕上是一个网页：「trudbot here!」",
      "博客 blog.trudbot.cn，GitHub github.com/trudbot，知乎上也能找到我。",
      "桌面上还开着一个没写完的 3D 小镇项目……咦，好像就是这里？",
    ]),
  );

  bookshelf(room, "east", 0.5, 2.6, 2.6, 3);
  level.interact("翻翻书架", RW / 2 - 1.2, 0.5, 1.5, () =>
    ctx.say("书架", [pick(["一本《Three.js 从入门到放弃》，书页上画满了立方体。", "一本相册，里面全是蓝色头发的自拍。", "一本游戏攻略：《生化危机4》全收集指南。"])]),
  );

  const mirror = group(
    mesh(geo.box(1.1, 1.9, 0.1, 0.3), toon("#FFD166")),
    mesh(geo.box(0.9, 1.7, 0.06, 0.25), toon("#dff6ff", { emissive: "#bfe9ff", emissiveIntensity: 0.3 }), { pos: [0, 0, 0.04] }),
  );
  placeOnWall(mirror, "west", -2.8, 1.6);
  room.decor.west.add(mirror);
  level.interact("照照镜子", -RW / 2 + 1.1, -2.8, 1.4, () =>
    ctx.say("镜子", ["镜子里是一头蓝色头发的自己。", "嗯，今天也很可爱。"]),
  );

  const posterTex = canvasTexture(256, 340, (c) => {
    c.fillStyle = "#FFEAA7";
    c.fillRect(0, 0, 256, 340);
    c.fillStyle = "#1f8fea";
    c.beginPath();
    c.arc(128, 150, 80, Math.PI, 0);
    c.lineTo(208, 220);
    c.lineTo(48, 220);
    c.fill();
    c.fillStyle = "#fde9e1";
    c.beginPath();
    c.arc(128, 170, 58, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1f8fea";
    c.fillRect(70, 110, 116, 36);
    c.fillStyle = "#2c1b26";
    c.fillRect(100, 168, 12, 18);
    c.fillRect(144, 168, 12, 18);
    c.fillStyle = "#b95a55";
    c.fillRect(120, 200, 16, 6);
    c.fillStyle = "#1c1729";
    c.font = labelFont(34, 900);
    c.textAlign = "center";
    c.fillText("BLUE ♪", 128, 300);
  });
  poster(room, "north", 0, 2.4, posterTex, 1.2, 1.6, "#FF6B9D");
  plant(room, 6, 4, 1.1);
  plant(room, -6, 4, 0.9);

  const beanbag = mesh(geo.sphere(0.7, 18, 12), toon("#A78BFA"), { scale: [1, 0.6, 1] });
  beanbag.position.set(1.8, 0.35, 1.2);
  statics.add(beanbag);
  level.circle(1.8, 1.2, 0.65, 0.5);
  return room;
}

function cafe(ctx: GameContext) {
  const room = makeRoom("cafe", ctx, {
    floor: checker("#f6ead0", "#8a5a3c"),
    wall: "#FFEAA7",
    wainscot: "#c98a5a",
    trim: "#FFA94D",
    bg: "#3a2a24",
  });
  const { level, statics } = room;
  windowOn(room, "east", -1.5);
  windowOn(room, "west", -1.5);
  counter(room, 1.5, -3.4, 7, 1.2, 1.1, "#c98a5a", "#f3e3bf");
  level.addStar("house-cafe", -1.2, 2.0, -3.4);

  const machine = group(
    mesh(geo.box(1.1, 0.9, 0.6, 0.1), toon("#d8dde8"), { pos: [0, 0.45, 0] }),
    mesh(geo.box(1.15, 0.12, 0.65, 0.05), toon("#3b3f5c"), { pos: [0, 0.95, 0] }),
    mesh(geo.cyl(0.07, 0.07, 0.25, 8), toon("#3b3f5c"), { pos: [-0.25, 0.3, 0.35] }),
    mesh(geo.cyl(0.07, 0.07, 0.25, 8), toon("#3b3f5c"), { pos: [0.25, 0.3, 0.35] }),
    mesh(geo.sphere(0.06, 8, 6), toon("#FF6B9D", { emissive: "#FF6B9D", emissiveIntensity: 0.8 }), { pos: [0.4, 0.7, 0.31] }),
  );
  machine.position.set(3.2, 1.1, -3.5);
  statics.add(machine);
  for (let i = 0; i < 4; i++) {
    statics.add(mesh(geo.cyl(0.12, 0.1, 0.22, 12), toon(PALETTE[i]), { pos: [0.4 + i * 0.35, 1.21, -3.1] }));
  }
  const steamAt = new THREE.Vector3(3.2, 2.2, -3.4);
  level.updaters.push(() => {
    if (Math.random() < 0.08) level.fx.emit({ pos: steamAt, spread: 0.2, vel: [0, 0.6, 0], colors: ["#ffffff"], size: 0.4, life: 1.6, grow: true });
  });
  level.interact("点一杯拿铁", 3.2, -2.3, 1.4, () => {
    ctx.boost(30);
    ctx.audio.play("boost");
    level.glow.emit({ pos: ctx.playerPosition().clone().setY(1.2), count: 30, speed: 3, colors: ["#FFD166", "#FFA94D"], size: 0.3, life: 0.9, sprite: Sprite.Star });
    ctx.say("熊老板", ["一杯拿铁，请慢用～", "喝完感觉浑身充满了力量！（30 秒内移动速度大幅提升）"]);
  });

  const bear = new THREE.Group();
  const fur = toon("#b07a4f");
  bear.add(
    mesh(geo.capsule(0.45, 0.5), fur, { pos: [0, 0.9, 0] }),
    mesh(geo.box(0.8, 0.7, 0.1, 0.05), toon("#ffffff"), { pos: [0, 0.85, 0.4] }),
    mesh(geo.sphere(0.42, 18, 14), fur, { pos: [0, 1.75, 0] }),
    mesh(geo.sphere(0.16, 12, 8), toon("#e8c9a8"), { pos: [0, 1.68, 0.36], scale: [1.2, 0.8, 0.8] }),
    mesh(geo.sphere(0.06, 8, 6), toon("#1c1729", { outline: false }), { pos: [0, 1.73, 0.5] }),
    mesh(geo.sphere(0.045, 8, 6), toon("#1c1729", { outline: false }), { pos: [0.14, 1.85, 0.37] }),
    mesh(geo.sphere(0.045, 8, 6), toon("#1c1729", { outline: false }), { pos: [-0.14, 1.85, 0.37] }),
    mesh(geo.sphere(0.15, 12, 8), fur, { pos: [0.32, 2.1, 0] }),
    mesh(geo.sphere(0.15, 12, 8), fur, { pos: [-0.32, 2.1, 0] }),
    mesh(geo.cyl(0.3, 0.34, 0.22, 16), toon("#ffffff"), { pos: [0, 2.2, 0] }),
  );
  bear.position.set(0, 0, -4.6);
  bear.userData.keep = true;
  level.scene.add(bear);
  level.updaters.push((_, t) => {
    bear.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
    bear.rotation.y = Math.sin(t * 0.7) * 0.3;
  });
  level.interact("和熊老板聊天", 0, -2.3, 1.4, () =>
    ctx.say("熊老板", [pick(["欢迎光临泡泡咖啡馆！今天的推荐是蜂蜜拿铁。", "听说音乐小屋里的钢琴会自己唱歌？", "我年轻时也染过蓝头发，后来掉毛就……唉。", "观星台晚上才开放哦。"])]),
  );

  const menu = textPanel(["MENU", "拿铁 ☕ 18", "美式 16", "抹茶 20", "蜂蜜蛋糕 12"], "#2e3a2f", "#fdf6ec", 512, 420, 40);
  poster(room, "north", 1.5, 2.8, menu, 2.2, 1.8, "#8a5a3c");
  for (const [x, z, c] of [
    [-4.2, 1.2, "#FF8FAB"],
    [0.5, 2.2, "#7DD3FC"],
    [4.6, 1.0, "#A78BFA"],
  ] as const) {
    roundTable(room, x, z, "#fdf6ec", 0.75, 0.8);
    statics.add(mesh(geo.cyl(0.12, 0.1, 0.2, 12), toon(c), { pos: [x + 0.2, 0.95, z] }));
    chair(room, x - 1.1, z, Math.PI / 2, c);
    chair(room, x + 1.1, z, -Math.PI / 2, c);
  }
  plant(room, -6, -4.3);
  plant(room, 6.2, 4.4);
  return room;
}

function library(ctx: GameContext) {
  const room = makeRoom("library", ctx, {
    floor: planks("#8a5a3c", "#6b4630"),
    wall: wallpaper("#EDE9FE", "#C4B5FD", "stripes"),
    wainscot: "#818CF8",
    trim: "#6366c9",
    bg: "#1c1d3a",
    lamp: "#ffe2b0",
  });
  const { level, statics } = room;
  rug(room, 0, 0.5, 3, "#818CF8", "#A78BFA");
  [-5, -2.4, 2.4, 5].forEach((u, i) => bookshelf(room, "north", u, 2.5, 3.4, i + 5));
  windowOn(room, "north", 0, 2.6, 1.8, 2.2);
  bookshelf(room, "east", -2, 2.5, 3, 11);
  bookshelf(room, "west", -2, 2.5, 3, 13);
  const quotes = [
    "「海内存知己，天涯若比邻。」—— 王勃",
    "「行到水穷处，坐看云起时。」—— 王维",
    "「长风破浪会有时，直挂云帆济沧海。」—— 李白",
    "「山重水复疑无路，柳暗花明又一村。」—— 陆游",
    "一本写满代码的笔记本，扉页上写着：Hello, World!",
    "一本《trudbot 小镇导游手册》：「观星台的望远镜，晚上才能看到星星。」",
  ];
  level.interact("翻翻书", 0, -3.8, 2.6, () => ctx.say("书页上写着", [pick(quotes)]));

  const table = group(
    mesh(geo.box(3.4, 0.12, 1.6, 0.05), toon("#c98a5a"), { pos: [0, 0.82, 0] }),
    ...[
      [1.5, 0.65],
      [-1.5, 0.65],
      [1.5, -0.65],
      [-1.5, -0.65],
    ].map(([x, z]) => mesh(geo.box(0.12, 0.8, 0.12, 0.03), toon("#8a5a3c"), { pos: [x, 0.4, z] })),
    mesh(geo.box(0.6, 0.1, 0.45, 0.02), toon("#FF6B9D"), { pos: [-0.8, 0.93, 0.1], rot: [0, 0.3, 0] }),
    mesh(geo.box(0.6, 0.1, 0.45, 0.02), toon("#FFD166"), { pos: [-0.75, 1.03, 0.05], rot: [0, -0.2, 0] }),
    mesh(geo.cyl(0.05, 0.12, 0.5, 8), toon("#3b3f5c"), { pos: [1.1, 1.13, -0.3] }),
    mesh(geo.cone(0.3, 0.3, 14), toon("#7DFFC7", { emissive: "#7DFFC7", emissiveIntensity: 0.4 }), { pos: [1.1, 1.45, -0.3] }),
  );
  statics.add(place(table, 0, 1));
  level.box(0, 1, 3.4, 1.6, 0.88);
  level.addStar("house-library", -0.4, 1.8, 1);
  chair(room, -0.9, 2.3, Math.PI, "#A78BFA");
  chair(room, 0.9, 2.3, Math.PI, "#A78BFA");

  const globe = group(
    mesh(geo.sphere(0.5, 20, 14), toon("#7DD3FC"), { pos: [0, 1.4, 0] }),
    mesh(geo.sphere(0.2, 10, 8), toon("#7DFFC7"), { pos: [0.3, 1.55, 0.28], scale: [1, 0.6, 0.6] }),
    mesh(geo.sphere(0.18, 10, 8), toon("#7DFFC7"), { pos: [-0.3, 1.25, 0.3], scale: [0.8, 1, 0.6] }),
    mesh(geo.torus(0.58, 0.035, Math.PI, 6, 16), toon("#FFD166"), { pos: [0, 1.4, 0], rot: [0, Math.PI / 2, 0] }),
  );
  const stand = group(
    mesh(geo.cyl(0.06, 0.08, 0.9, 8), toon("#8a5a3c"), { pos: [0, 0.45, 0] }),
    mesh(geo.cyl(0.35, 0.4, 0.08, 14), toon("#8a5a3c"), { pos: [0, 0.04, 0] }),
  );
  statics.add(place(stand, 5, 3));
  globe.position.set(5, 0, 3);
  spinner(room, globe, 0.6);
  level.circle(5, 3, 0.55);
  level.interact("转转地球仪", 5, 3, 1.5, () => {
    globe.rotation.y += 4;
    ctx.audio.play("whoosh");
    ctx.toast(pick(["地球仪停在了……南极！", "它指向了一个叫「trudbot 小镇」的小点。", "转得太快，有点晕……"]));
  });

  const ladder = group(
    mesh(geo.box(0.08, 3.2, 0.08, 0.02), toon("#c98a5a"), { pos: [-0.35, 1.6, 0] }),
    mesh(geo.box(0.08, 3.2, 0.08, 0.02), toon("#c98a5a"), { pos: [0.35, 1.6, 0] }),
    ...[0.4, 0.9, 1.4, 1.9, 2.4, 2.9].map((y) => mesh(geo.box(0.7, 0.06, 0.06, 0.02), toon("#c98a5a"), { pos: [0, y, 0] })),
  );
  ladder.rotation.x = -0.18;
  ladder.position.set(3.7, 0, -4.4);
  statics.add(ladder);
  plant(room, -6, 4.2);
  return room;
}

function arcadeScreen(kind: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 96;
  const c = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const draw = (t: number) => {
    c.fillStyle = "#0b0c24";
    c.fillRect(0, 0, 128, 96);
    c.fillStyle = "#ffffff";
    for (let i = 0; i < 16; i++) c.fillRect((i * 37) % 128, (i * 23 + t * 30) % 96, 1, 1);
    if (kind === 0) {
      const colors = ["#FF6B9D", "#7DFFC7", "#FFD166"];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 6; col++) {
          const x = 14 + col * 17 + Math.sin(t * 2) * 8;
          const y = 12 + row * 13 + ((t * 2) % 10);
          c.fillStyle = colors[row];
          c.fillRect(x, y, 10, 6);
          c.fillRect(x + (Math.floor(t * 4) % 2 ? 0 : 2), y + 6, 2, 3);
          c.fillRect(x + (Math.floor(t * 4) % 2 ? 8 : 6), y + 6, 2, 3);
        }
      }
      c.fillStyle = "#5CE0D8";
      c.fillRect(56 + Math.sin(t * 1.3) * 40, 84, 14, 5);
    } else {
      const bx = 64 + Math.sin(t * 2.1) * 54;
      const by = 48 + Math.sin(t * 3.3) * 36;
      c.fillStyle = "#FFD166";
      c.fillRect(bx, by, 5, 5);
      c.fillStyle = "#FF8FAB";
      c.fillRect(4, by - 10, 4, 22);
      c.fillStyle = "#7DD3FC";
      c.fillRect(120, 48 + Math.sin(t * 3.3 - 0.3) * 36 - 10, 4, 22);
      c.fillStyle = "#ffffff";
      for (let y = 0; y < 96; y += 8) c.fillRect(63, y, 2, 4);
    }
    c.fillStyle = "#ffffff";
    c.font = "bold 9px monospace";
    c.fillText(`SCORE ${String(Math.floor(t * 130) % 100000).padStart(5, "0")}`, 4, 9);
    tex.needsUpdate = true;
  };
  draw(0);
  return { tex, draw };
}

function arcade(ctx: GameContext) {
  const gridTex = repeat(
    canvasTexture(128, 128, (c) => {
      c.fillStyle = "#1a1b3d";
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = "#FF6B9D";
      c.globalAlpha = 0.45;
      c.lineWidth = 3;
      c.strokeRect(0, 0, 128, 128);
    }),
    8,
    6,
  );
  const room = makeRoom("arcade", ctx, {
    floor: gridTex,
    wall: wallpaper("#2e3066", "#4c4f9a", "stars"),
    wainscot: "#1c1d3a",
    trim: "#5CE0D8",
    bg: "#0c0d22",
    lamp: "#c9a8ff",
  });
  const { level, statics } = room;
  const neonPink = toon("#FF6B9D", { emissive: "#FF6B9D", emissiveIntensity: 1.2 });
  const neonCyan = toon("#5CE0D8", { emissive: "#5CE0D8", emissiveIntensity: 1.2 });
  for (const side of ["north", "east", "west"] as const) {
    const len = side === "north" ? RW - 0.4 : RD - 0.4;
    const strip = mesh(geo.box(len, 0.1, 0.08, 0.03), side === "north" ? neonPink : neonCyan, { cast: false });
    placeOnWall(strip, side, 0, 3.5);
    room.decor[side].add(strip);
  }

  const screens = [arcadeScreen(0), arcadeScreen(1)];
  const cabinetColors = ["#FF6B9D", "#5CE0D8", "#FFD166", "#A78BFA"];
  const cabinetX = [-4.5, -1.5, 1.5, 4.5];
  cabinetX.forEach((x, i) => {
    const cab = group(
      mesh(geo.box(1.3, 2.3, 1.0, 0.1), toon(cabinetColors[i]), { pos: [0, 1.15, 0] }),
      mesh(geo.box(1.1, 0.85, 0.1, 0.04), toon("#0b0c24"), { pos: [0, 1.65, 0.48] }),
      mesh(geo.plane(1.0, 0.75), basic("#ffffff", { map: screens[i % 2].tex }), { pos: [0, 1.65, 0.54], rot: [-0.08, 0, 0], cast: false }),
      mesh(geo.box(1.3, 0.3, 0.6, 0.06), toon("#1c1d3a"), { pos: [0, 1.0, 0.7], rot: [0.3, 0, 0] }),
      mesh(geo.sphere(0.08, 8, 6), toon("#FF6B9D"), { pos: [-0.3, 1.2, 0.78] }),
      mesh(geo.cyl(0.03, 0.03, 0.18, 6), toon("#3b3f5c"), { pos: [-0.3, 1.1, 0.75] }),
      mesh(geo.sphere(0.07, 8, 6), toon("#FFD166"), { pos: [0.15, 1.12, 0.78] }),
      mesh(geo.sphere(0.07, 8, 6), toon("#7DFFC7"), { pos: [0.35, 1.12, 0.78] }),
      mesh(geo.box(1.3, 0.4, 0.9, 0.08), toon(cabinetColors[(i + 1) % 4], { emissive: cabinetColors[(i + 1) % 4], emissiveIntensity: 0.5 }), { pos: [0, 2.45, -0.05] }),
    );
    statics.add(place(cab, x, -RD / 2 + 0.8));
    level.box(x, -RD / 2 + 0.8, 1.3, 1.4, SOLID);
    level.interact("玩一局", x, -RD / 2 + 2.2, 1.1, () => {
      ctx.audio.play("arcade");
      const score = Math.floor(1000 + Math.random() * 98000);
      ctx.say(i % 2 ? "像素乒乓" : "星际小怪兽", [`你打出了 ${score.toLocaleString()} 分！`, score > 60000 ? "新纪录！屏幕上跳出了你的名字：BLUE ✨" : "再来一局？"]);
    });
  });
  let screenClock = 0;
  level.updaters.push((dt, t) => {
    screenClock += dt;
    if (screenClock < 0.08) return;
    screenClock = 0;
    for (const s of screens) s.draw(t);
  });

  // Claw machine
  const glass = toon("#dff6ff", { transparent: true, opacity: 0.25, outline: false });
  const claw = group(
    mesh(geo.box(1.8, 1.0, 1.8, 0.1), toon("#FF8FAB"), { pos: [0, 0.5, 0] }),
    mesh(geo.box(1.7, 1.6, 1.7, 0.04), glass, { pos: [0, 1.8, 0], cast: false }),
    mesh(geo.box(1.8, 0.35, 1.8, 0.1), toon("#FF8FAB"), { pos: [0, 2.75, 0] }),
    mesh(geo.cyl(0.03, 0.03, 0.6, 6), toon("#d8dde8"), { pos: [0.2, 2.3, -0.1] }),
    mesh(geo.cone(0.14, 0.2, 6), toon("#d8dde8"), { pos: [0.2, 1.95, -0.1], rot: [Math.PI, 0, 0] }),
  );
  for (let i = 0; i < 9; i++) {
    claw.add(mesh(geo.sphere(0.22, 12, 8), toon(PALETTE[i % PALETTE.length]), { pos: [((i % 3) - 1) * 0.45, 1.25 + Math.floor(i / 3) * 0.08, (Math.floor(i / 3) - 1) * 0.45] }));
  }
  statics.add(place(claw, 5.4, 1.8));
  level.box(5.4, 1.8, 1.8, 1.8, SOLID);
  level.interact("抓娃娃", 4.1, 1.8, 1.2, () => {
    ctx.audio.play("claw");
    const win = Math.random() < 0.45;
    ctx.say("抓娃娃机", win ? [`抓到了！是一只${pick(["蓝色小熊", "粉色兔兔", "星星抱枕", "橘猫玩偶"])}！`] : ["差一点点……爪子松开了。", "（每个人都会经历这种事）"]);
    if (win) level.glow.emit({ pos: { x: 5.4, y: 2, z: 1.8 }, count: 30, speed: 3, colors: PALETTE, size: 0.3, life: 1, sprite: Sprite.Star });
  });

  // Dance stage
  const tileMats = PALETTE.slice(0, 4).map((c) => toon(c, { emissive: c, emissiveIntensity: 0.3, unique: true }));
  const stage = new THREE.Group();
  stage.userData.keep = true;
  stage.add(mesh(geo.box(3, 0.3, 3, 0.06), toon("#1c1d3a"), { pos: [0, 0.15, 0] }));
  for (let i = 0; i < 9; i++) {
    stage.add(mesh(geo.box(0.85, 0.06, 0.85, 0.03), tileMats[i % 4], { pos: [((i % 3) - 1) * 0.95, 0.32, (Math.floor(i / 3) - 1) * 0.95], cast: false }));
  }
  stage.position.set(-4.8, 0, 1.5);
  level.scene.add(stage);
  level.box(-4.8, 1.5, 3, 3, 0.34);
  level.addStar("house-arcade", -4.8, 1.3, 1.5);
  let pulse = 0;
  level.updaters.push((dt, t) => {
    pulse = Math.max(0, pulse - dt);
    tileMats.forEach((m, i) => {
      m.emissiveIntensity = 0.25 + (Math.sin(t * (pulse > 0 ? 12 : 3) + i * 1.6) * 0.5 + 0.5) * (pulse > 0 ? 1.4 : 0.5);
    });
  });
  level.interact("跳支舞", -4.8, 1.5, 1.6, () => {
    pulse = 6;
    ctx.dance(6);
    for (let s = 0; s < 24; s++) {
      const d = s * 0.25;
      if (s % 4 === 0) ctx.audio.drum("kick", d);
      if (s % 4 === 2) ctx.audio.drum("snare", d);
      ctx.audio.drum("hat", d + 0.125);
    }
  });
  return room;
}

function flower(ctx: GameContext) {
  const room = makeRoom("flower", ctx, {
    floor: planks("#f3e3bf", "#dcc59a"),
    wall: wallpaper("#fdf6ec", "#e6fff5", "stripes"),
    wainscot: "#7DFFC7",
    trim: "#2fbf8a",
    bg: "#1f3a31",
  });
  const { level, statics } = room;
  windowOn(room, "north", -3);
  windowOn(room, "north", 3);
  counter(room, 4.2, -3.8, 3.6, 1.1, 1.05, "#2fa57c", "#fdf6ec");
  statics.add(mesh(geo.box(0.7, 0.45, 0.5, 0.06), toon("#FFD166"), { pos: [4.8, 1.3, -3.8] }));

  const heads: Array<[number, number, number, string]> = [];
  const buckets: Array<[number, number, string]> = [
    [-5, -3.8, "#FF6B9D"],
    [-3.6, -3.8, "#FFD166"],
    [-2.2, -3.8, "#A78BFA"],
    [-5, -2.4, "#FFA94D"],
    [-3.6, -2.4, "#ffffff"],
    [-2.2, -2.4, "#FF8FAB"],
  ];
  for (const [x, z, c] of buckets) {
    statics.add(mesh(geo.cyl(0.45, 0.35, 0.7, 14), toon("#9fb3c8"), { pos: [x, 0.35, z] }));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = i === 0 ? 0 : 0.28;
      heads.push([x + Math.cos(a) * r, 1.15 + (i % 3) * 0.1, z + Math.sin(a) * r, c]);
    }
    level.circle(x, z, 0.5, SOLID);
  }
  const flowerHeads = new THREE.InstancedMesh(geo.ico(0.16, 1), toon("#ffffff", { outline: false }), heads.length);
  const stems = new THREE.InstancedMesh(geo.cyl(0.02, 0.02, 0.6, 5), toon("#4f8a3a", { outline: false }), heads.length);
  const m4 = new THREE.Matrix4();
  const color = new THREE.Color();
  heads.forEach(([x, y, z, c], i) => {
    flowerHeads.setMatrixAt(i, m4.makeTranslation(x, y, z));
    flowerHeads.setColorAt(i, color.set(c));
    stems.setMatrixAt(i, m4.makeTranslation(x, y - 0.35, z));
  });
  flowerHeads.castShadow = true;
  level.scene.add(flowerHeads, stems);

  const colors = ["#FF6B9D", "#FFD166", "#A78BFA", "#FFA94D", "#ffffff", "#FF8FAB"];
  const names = ["粉玫瑰", "向日葵", "薰衣草", "橘色郁金香", "小雏菊", "樱花"];
  let pickIndex = 0;
  level.interact("挑一朵花", -3.6, -1.2, 1.8, () => {
    const i = pickIndex++ % colors.length;
    ctx.holdFlower(colors[i]);
    ctx.audio.play("pop");
    ctx.toast(`你拿起了一朵${names[i]} 🌸`);
    level.fx.emit({ pos: ctx.playerPosition().clone().setY(1.2), count: 12, speed: 1.5, colors: [colors[i]], size: 0.25, life: 1, sprite: Sprite.Heart });
  });

  const shelf = group(mesh(geo.box(3, 0.1, 0.7, 0.03), toon("#c98a5a"), { pos: [0, 0.9, 0] }), mesh(geo.box(3, 0.1, 0.7, 0.03), toon("#c98a5a"), { pos: [0, 1.8, 0] }));
  for (const x of [-1.4, 1.4]) shelf.add(mesh(geo.box(0.1, 1.9, 0.7, 0.03), toon("#8a5a3c"), { pos: [x, 0.95, 0] }));
  for (let i = 0; i < 6; i++) {
    const x = -1 + (i % 3) * 1;
    const y = i < 3 ? 0.95 : 1.85;
    shelf.add(mesh(geo.cyl(0.18, 0.14, 0.3, 10), toon("#e07a5f"), { pos: [x, y + 0.15, 0] }));
    shelf.add(mesh(geo.sphere(0.22, 12, 8), toon(i % 2 ? "#6fcf6a" : "#5bbf73"), { pos: [x, y + 0.45, 0] }));
  }
  placeOnWall(shelf, "east", 1.5, 0, 0.4);
  statics.add(shelf);
  level.colliderFrom(shelf, SOLID);

  const table = group(
    mesh(geo.box(2.4, 0.12, 1.4, 0.05), toon("#fdf6ec"), { pos: [0, 0.85, 0] }),
    ...[
      [1.05, 0.55],
      [-1.05, 0.55],
      [1.05, -0.55],
      [-1.05, -0.55],
    ].map(([x, z]) => mesh(geo.box(0.12, 0.8, 0.12, 0.03), toon("#2fa57c"), { pos: [x, 0.4, z] })),
    mesh(geo.cyl(0.25, 0.2, 0.5, 14), toon("#7DD3FC", { transparent: true, opacity: 0.6 }), { pos: [0.6, 1.16, 0] }),
    mesh(geo.sphere(0.35, 14, 10), toon("#FF8FAB"), { pos: [0.6, 1.6, 0] }),
  );
  statics.add(place(table, 0, 1.4));
  level.box(0, 1.4, 2.4, 1.4, 0.92);
  level.addStar("house-flower", -0.5, 1.85, 1.4);

  const can = group(
    mesh(geo.cyl(0.25, 0.3, 0.45, 14), toon("#5CE0D8"), { pos: [0, 0.23, 0] }),
    mesh(geo.cyl(0.04, 0.06, 0.55, 8), toon("#5CE0D8"), { pos: [0.35, 0.4, 0], rot: [0, 0, -0.9] }),
    mesh(geo.torus(0.15, 0.03, Math.PI, 6, 12), toon("#5CE0D8"), { pos: [0, 0.5, 0] }),
  );
  statics.add(place(can, 2.6, 3.8));
  plant(room, -6, 4.2, 1.2);
  plant(room, 6, 4.2, 1.2);
  return room;
}

function bakery(ctx: GameContext) {
  const room = makeRoom("bakery", ctx, {
    floor: checker("#ffffff", "#FFC4D6"),
    wall: wallpaper("#fff1f5", "#ffe0ea", "stripes"),
    wainscot: "#FF8FAB",
    trim: "#FF6B9D",
    bg: "#3a2230",
  });
  const { level, statics } = room;
  windowOn(room, "east", 0);
  windowOn(room, "west", 0);

  const glass = toon("#dff6ff", { transparent: true, opacity: 0.3, outline: false });
  const caseG = group(
    mesh(geo.box(5, 0.9, 1.2, 0.08), toon("#FF8FAB"), { pos: [0, 0.45, 0] }),
    mesh(geo.box(4.9, 0.8, 1.1, 0.04), glass, { pos: [0, 1.3, 0], cast: false }),
  );
  const treats: Array<[number, string, "cake" | "bun"]> = [
    [-2, "#FFC4D6", "cake"],
    [-1.2, "#FFD166", "bun"],
    [-0.4, "#A78BFA", "cake"],
    [0.4, "#FFA94D", "bun"],
    [1.2, "#7DFFC7", "cake"],
    [2, "#FF6B9D", "bun"],
  ];
  for (const [x, c, kind] of treats) {
    if (kind === "cake") {
      caseG.add(mesh(geo.cyl(0.28, 0.28, 0.3, 16), toon(c), { pos: [x, 1.07, 0] }));
      caseG.add(mesh(geo.sphere(0.07, 8, 6), toon("#e63950"), { pos: [x, 1.27, 0] }));
    } else {
      caseG.add(mesh(geo.sphere(0.26, 14, 10), toon("#e0a060"), { pos: [x, 1.08, 0], scale: [1.2, 0.7, 1] }));
      caseG.add(mesh(geo.sphere(0.2, 12, 8), toon(c), { pos: [x, 1.18, 0], scale: [1.1, 0.35, 0.9] }));
    }
  }
  statics.add(place(caseG, -2, -3.6));
  level.box(-2, -3.6, 5, 1.2, SOLID);

  const oven = group(
    mesh(geo.box(2, 2.4, 1.2, 0.15), toon("#d8dde8"), { pos: [0, 1.2, 0] }),
    mesh(geo.box(1.4, 0.8, 0.1, 0.06), toon("#FFA94D", { emissive: "#FF6B3D", emissiveIntensity: 0.9 }), { pos: [0, 1.2, 0.6] }),
    mesh(geo.box(1.5, 0.1, 0.2, 0.04), toon("#3b3f5c"), { pos: [0, 1.75, 0.65] }),
  );
  statics.add(place(oven, 4.6, -4.4));
  level.box(4.6, -4.4, 2, 1.2, SOLID);
  const ovenLight = new THREE.PointLight("#ff9a4d", 4, 5, 1.5);
  ovenLight.position.set(4.6, 1.2, -3.4);
  level.scene.add(ovenLight);
  level.updaters.push((_, t) => {
    ovenLight.intensity = 4 + Math.sin(t * 7) * 0.8 + Math.sin(t * 13) * 0.4;
  });
  level.interact("看看烤箱", 4.6, -3.1, 1.3, () =>
    ctx.say("烤箱", ["烤箱暖烘烘的，里面的可颂正在慢慢膨胀。", "好香……肚子咕咕叫了。"]),
  );

  const bread = group();
  for (let row = 0; row < 3; row++) {
    bread.add(mesh(geo.box(2.4, 0.08, 0.6, 0.02), toon("#c98a5a"), { pos: [0, 0.6 + row * 0.8, 0.3] }));
    for (let i = 0; i < 4; i++) {
      bread.add(mesh(geo.capsule(0.14, 0.3), toon(row === 1 ? "#d9954f" : "#e8b070"), { pos: [-0.9 + i * 0.6, 0.78 + row * 0.8, 0.3], rot: [0, 0, Math.PI / 2] }));
    }
  }
  placeOnWall(bread, "west", -3, 0);
  statics.add(bread);
  level.colliderFrom(bread, SOLID);

  const table = group(
    mesh(geo.cyl(1.1, 1.1, 0.1, 28), toon("#fdf6ec"), { pos: [0, 0.8, 0] }),
    mesh(geo.cyl(0.1, 0.12, 0.8, 10), toon("#FF6B9D"), { pos: [0, 0.4, 0] }),
    mesh(geo.cyl(0.7, 0.7, 0.4, 24), toon("#fff1f5"), { pos: [0.1, 1.05, 0] }),
    mesh(geo.cyl(0.5, 0.5, 0.35, 24), toon("#FFC4D6"), { pos: [0.1, 1.42, 0] }),
    mesh(geo.cyl(0.3, 0.3, 0.3, 20), toon("#fff1f5"), { pos: [0.1, 1.75, 0] }),
    mesh(geo.sphere(0.12, 10, 8), toon("#e63950"), { pos: [0.1, 1.98, 0] }),
    mesh(geo.torus(0.7, 0.06, Math.PI * 2, 6, 28), toon("#FF8FAB"), { pos: [0.1, 1.23, 0], rot: [Math.PI / 2, 0, 0] }),
  );
  statics.add(place(table, 1.2, 1.2));
  level.circle(1.2, 1.2, 1.1, 0.85);
  level.addStar("house-bakery", 0.35, 1.75, 1.8);
  level.interact("尝一口魔法蛋糕", 1.2, 2.7, 1.3, () => {
    ctx.grow(25);
    ctx.audio.play("grow");
    level.glow.emit({ pos: ctx.playerPosition().clone().setY(1), count: 40, speed: 3, colors: ["#FF8FAB", "#FFD166", "#ffffff"], size: 0.3, life: 1.2, sprite: Sprite.Star });
    ctx.say("魔法蛋糕", ["啊呜——甜甜的奶油在嘴里化开了。", "咦？好像……变大了！（25 秒）"]);
  });

  const chalk = textPanel(["今日推荐", "草莓蛋糕", "牛角包", "蓝莓马芬"], "#2e3a2f", "#fdf6ec", 384, 384, 44);
  poster(room, "north", 3.5, 2.6, chalk, 1.6, 1.6, "#c98a5a");
  plant(room, -6, 4.2);
  return room;
}

function music(ctx: GameContext) {
  const room = makeRoom("music", ctx, {
    floor: planks("#c98a5a", "#a06a45"),
    wall: wallpaper("#EDE9FE", "#DDD6FE", "dots"),
    wainscot: "#A78BFA",
    trim: "#7c5ce0",
    bg: "#1d1638",
  });
  const { level, statics } = room;
  windowOn(room, "east", 0.5);
  windowOn(room, "west", 0.5);
  const stage = mesh(geo.box(9, 0.5, 3.4, 0.08), toon("#7c5ce0"), { pos: [0, 0.25, -RD / 2 + 1.7] });
  statics.add(stage);
  statics.add(mesh(geo.box(9.1, 0.08, 0.1, 0.03), toon("#FFD166", { emissive: "#FFD166", emissiveIntensity: 0.6 }), { pos: [0, 0.46, -RD / 2 + 3.42], cast: false }));
  level.box(0, -RD / 2 + 1.7, 9, 3.4, 0.5);
  level.addStar("house-music", 0, 1.5, -RD / 2 + 1.7);

  const pianoKeys = canvasTexture(512, 64, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 512, 64);
    c.fillStyle = "#1c1729";
    for (let i = 0; i < 22; i++) c.fillRect(i * 23.3, 0, 2, 64);
    for (let i = 0; i < 21; i++) if (![2, 6, 9, 13, 16, 20].includes(i % 21)) c.fillRect(i * 23.3 + 15, 0, 14, 38);
  });
  const piano = group(
    mesh(geo.box(2.4, 1.3, 0.8, 0.08), toon("#1c1729"), { pos: [0, 0.95, -0.2] }),
    mesh(geo.box(2.4, 0.1, 0.45, 0.02), toon("#ffffff", { map: pianoKeys, outline: false }), { pos: [0, 0.85, 0.35] }),
    mesh(geo.box(2.4, 0.3, 0.15, 0.04), toon("#1c1729"), { pos: [0, 1.75, -0.5] }),
    mesh(geo.box(0.1, 0.75, 0.6, 0.03), toon("#1c1729"), { pos: [-1.1, 0.38, 0.1] }),
    mesh(geo.box(0.1, 0.75, 0.6, 0.03), toon("#1c1729"), { pos: [1.1, 0.38, 0.1] }),
    mesh(geo.box(1.2, 0.1, 0.45, 0.04), toon("#FF8FAB"), { pos: [0, 0.5, 1.1] }),
  );
  statics.add(place(piano, -4.4, 0.4));
  level.box(-4.4, 0.2, 2.4, 1.2, SOLID);
  const tune: Array<[number, number]> = [
    [72, 0.5], [72, 0.5], [79, 0.5], [79, 0.5], [81, 0.5], [81, 0.5], [79, 1],
    [77, 0.5], [77, 0.5], [76, 0.5], [76, 0.5], [74, 0.5], [74, 0.5], [72, 1],
  ];
  let notesLeft = 0;
  level.updaters.push((dt) => {
    if (notesLeft <= 0) return;
    notesLeft -= dt;
    if (Math.random() < dt * 8) {
      level.glow.emit({ pos: { x: -4.4, y: 2, z: 0.6 }, spread: 1.2, vel: [0, 1.2, 0], speed: 0.4, colors: ["#A78BFA", "#7DD3FC", "#FF8FAB", "#FFD166"], size: 0.6, life: 1.8, sprite: Sprite.Note });
    }
  });
  level.interact("弹钢琴", -4.4, 1.9, 1.3, () => {
    notesLeft = ctx.audio.melody(tune, 150) || 5;
    ctx.toast("♪ 一闪一闪亮晶晶～");
  });

  const drumMat = toon("#FF6B9D");
  const skin = toon("#fdf6ec");
  const drums = group(
    mesh(geo.cyl(0.55, 0.55, 0.6, 20), drumMat, { pos: [0, 0.8, 0], rot: [Math.PI / 2, 0, 0] }),
    mesh(geo.cyl(0.5, 0.5, 0.62, 20), skin, { pos: [0, 0.8, 0.01], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 1] }),
    mesh(geo.cyl(0.3, 0.3, 0.3, 16), drumMat, { pos: [0.75, 1.1, 0.3] }),
    mesh(geo.cyl(0.28, 0.28, 0.31, 16), skin, { pos: [0.75, 1.1, 0.3] }),
    mesh(geo.cyl(0.02, 0.02, 1.4, 6), toon("#d8dde8"), { pos: [-0.8, 0.7, 0.2] }),
    mesh(geo.cyl(0.4, 0.4, 0.03, 16), toon("#FFD166"), { pos: [-0.8, 1.42, 0.2] }),
  );
  drums.position.set(2.2, 0.5, -RD / 2 + 1.6);
  statics.add(drums);
  level.interact("敲敲鼓", 2.2, -RD / 2 + 3.3, 1.3, () => {
    for (let s = 0; s < 16; s++) {
      const d = s * 0.18;
      if (s % 4 === 0) ctx.audio.drum("kick", d);
      if (s % 4 === 2) ctx.audio.drum("snare", d);
      ctx.audio.drum("hat", d);
    }
    ctx.toast("咚 哒 咚咚 哒！");
  });

  const guitar = group(
    mesh(geo.sphere(0.35, 16, 10), toon("#FFA94D"), { pos: [0, 0.55, 0], scale: [1, 1.1, 0.35] }),
    mesh(geo.sphere(0.27, 16, 10), toon("#FFA94D"), { pos: [0, 0.95, 0], scale: [1, 1, 0.35] }),
    mesh(geo.cyl(0.08, 0.08, 0.02, 12), toon("#1c1729", { outline: false }), { pos: [0, 0.8, 0.12], rot: [Math.PI / 2, 0, 0] }),
    mesh(geo.box(0.1, 0.9, 0.06, 0.02), toon("#8a5a3c"), { pos: [0, 1.55, 0] }),
    mesh(geo.box(0.16, 0.2, 0.07, 0.02), toon("#3b3f5c"), { pos: [0, 2.05, 0] }),
  );
  guitar.rotation.z = 0.15;
  guitar.position.set(-2.2, 0.5, -RD / 2 + 1.2);
  statics.add(guitar);

  for (const x of [-4, 4]) {
    const speaker = group(
      mesh(geo.box(1, 1.5, 0.8, 0.08), toon("#1c1729"), { pos: [0, 0.75, 0] }),
      mesh(geo.cyl(0.3, 0.3, 0.05, 20), toon("#4c4f9a"), { pos: [0, 0.5, 0.41], rot: [Math.PI / 2, 0, 0] }),
      mesh(geo.cyl(0.15, 0.15, 0.05, 16), toon("#4c4f9a"), { pos: [0, 1.15, 0.41], rot: [Math.PI / 2, 0, 0] }),
    );
    speaker.position.set(x, 0.5, -RD / 2 + 0.8);
    statics.add(speaker);
    level.box(x, -RD / 2 + 0.8, 1, 0.8, 2.0);
  }

  // Disco ball and party lights
  const ballTex = canvasTexture(128, 64, (c) => {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        c.fillStyle = (x + y) % 3 === 0 ? "#ffffff" : (x * y) % 2 ? "#c9d4e8" : "#8f9bb8";
        c.fillRect(x * 8, y * 8, 7, 7);
      }
    }
  });
  const ball = group(
    mesh(geo.sphere(0.45, 20, 14), toon("#ffffff", { map: ballTex }), {}),
    mesh(geo.cyl(0.015, 0.015, 1.2, 4), toon("#d8dde8"), { pos: [0, 0.8, 0] }),
  );
  ball.position.set(0, 3.2, 0.5);
  spinner(room, ball, 1.2);
  const spots = ["#FF6B9D", "#5CE0D8", "#FFD166"].map((c) => {
    const s = new THREE.SpotLight(c, 0, 16, 0.35, 0.5, 1);
    s.position.set(0, 3.8, 0.5);
    level.scene.add(s, s.target);
    return s;
  });
  let party = 0;
  level.updaters.push((dt, t) => {
    party = Math.max(0, party - dt);
    spots.forEach((s, i) => {
      s.intensity = party > 0 ? 60 : 0;
      const a = t * 1.5 + (i * Math.PI * 2) / 3;
      s.target.position.set(Math.cos(a) * 4, 0, Math.sin(a) * 3 + 0.5);
    });
    if (party > 0 && Math.random() < dt * 20) {
      level.glow.emit({ pos: { x: (Math.random() - 0.5) * 10, y: 3.5, z: (Math.random() - 0.5) * 8 }, vel: [0, -1, 0], colors: ["#FF6B9D", "#5CE0D8", "#FFD166", "#A78BFA"], size: 0.3, life: 2, sprite: Sprite.Star });
    }
  });
  level.interact("打开迪斯科球", 0, 1.6, 1.6, () => {
    party = 10;
    ctx.dance(8);
    ctx.audio.melody([[67, 0.5], [71, 0.5], [74, 0.5], [79, 1], [74, 0.5], [79, 1.5]], 160, "chip");
    ctx.toast("🪩 派对时间！");
  });
  rug(room, 0, 1.5, 2.2, "#A78BFA", "#FFD166");
  return room;
}

function observatory(ctx: GameContext) {
  const room = makeRoom("observatory", ctx, {
    floor: planks("#3b3f5c", "#2e3066"),
    wall: wallpaper("#1c1d3a", "#fff6c9", "stars"),
    wainscot: "#2e3066",
    trim: "#818CF8",
    bg: "#07081a",
    lamp: "#b8c4ff",
  });
  const { level, statics } = room;
  windowOn(room, "north", -3.5, 2.5, 2.2, 2);
  windowOn(room, "north", 3.5, 2.5, 2.2, 2);

  const mapTex = canvasTexture(512, 512, (c) => {
    c.fillStyle = "#1c1d3a";
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = "#818CF8";
    c.lineWidth = 6;
    for (const r of [240, 170, 100]) {
      c.beginPath();
      c.arc(256, 256, r, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = "#FFD166";
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 40; i++) {
      const a = i * 2.4;
      const r = 40 + ((i * 53) % 190);
      const p: [number, number] = [256 + Math.cos(a) * r, 256 + Math.sin(a) * r];
      pts.push(p);
      c.beginPath();
      c.arc(p[0], p[1], i % 5 === 0 ? 7 : 4, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = "rgba(255,209,102,0.5)";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 7; i++) c.lineTo(...pts[i * 3]);
    c.stroke();
  });
  statics.add(mesh(geo.cyl(3.4, 3.4, 0.04, 48), toon("#ffffff", { map: mapTex, outline: false }), { pos: [0, 0.02, 0.3], cast: false }));

  const platform = mesh(geo.cyl(1.6, 1.7, 0.35, 32), toon("#4c4f9a"), { pos: [0, 0.18, -1.8] });
  statics.add(platform);
  level.circle(0, -1.8, 1.65, 0.36);
  const scope = group(
    mesh(geo.cyl(0.08, 0.1, 1.3, 8), toon("#d8dde8"), { pos: [0.3, 0.65, 0], rot: [0, 0, 0.35] }),
    mesh(geo.cyl(0.08, 0.1, 1.3, 8), toon("#d8dde8"), { pos: [-0.3, 0.65, 0], rot: [0, 0, -0.35] }),
    mesh(geo.cyl(0.08, 0.1, 1.3, 8), toon("#d8dde8"), { pos: [0, 0.65, 0.3], rot: [-0.35, 0, 0] }),
    mesh(geo.cyl(0.3, 0.38, 2.6, 18), toon("#818CF8"), { pos: [0, 1.7, -0.3], rot: [-0.9, 0, 0] }),
    mesh(geo.torus(0.33, 0.07, Math.PI * 2, 8, 20), toon("#FFD166"), { pos: [0, 2.5, -1.3], rot: [0.67, 0, 0] }),
    mesh(geo.cyl(0.08, 0.08, 0.3, 8), toon("#3b3f5c"), { pos: [0, 1.05, 0.5], rot: [-0.9, 0, 0] }),
  );
  scope.position.set(0, 0.35, -1.8);
  statics.add(scope);
  level.circle(0, -2.1, 0.5, SOLID);
  level.addStar("house-observatory", 1.1, 1.3, -1.2);
  const nightSights = [
    "你看到了猎户座的腰带——三颗排成一行的亮星。",
    "北斗七星像一把勺子，勺口的两颗星指向北极星。",
    "月亮上的环形山清清楚楚，像一块奶酪。",
    "一颗流星划过！快许个愿吧～",
  ];
  level.interact(
    "用望远镜",
    0,
    -0.6,
    1.3,
    () => {
      if (ctx.isNight()) {
        ctx.audio.play("star");
        for (let i = 0; i < 3; i++) {
          level.glow.emit({ pos: { x: -5 + i * 2, y: 3.6, z: -RD / 2 + 0.6 }, vel: [6, -1.5, 0], colors: ["#fff6c9", "#FFD166"], size: 0.4, life: 1.2, sprite: Sprite.Star });
        }
        ctx.say("望远镜里", [pick(nightSights)]);
      } else {
        ctx.say("望远镜里", ["白茫茫一片……白天太亮了，什么星星都看不到。", "按 N 或者回家睡一觉，等到晚上再来吧。"]);
      }
    },
    () => (ctx.isNight() ? "看星星 ✨" : "用望远镜"),
  );

  const mobile = new THREE.Group();
  mobile.position.set(3.8, 3.2, 2);
  const planets: Array<[number, number, string]> = [
    [0.7, 0.22, "#FFA94D"],
    [1.3, 0.3, "#7DD3FC"],
    [1.9, 0.26, "#FF8FAB"],
  ];
  mobile.add(mesh(geo.sphere(0.35, 16, 12), toon("#FFD166", { emissive: "#FFD166", emissiveIntensity: 0.8 })));
  for (const [r, s, c] of planets) {
    const arm = group(mesh(geo.sphere(s, 14, 10), toon(c), { pos: [r, -0.3, 0] }), mesh(geo.cyl(0.01, 0.01, 0.3, 4), toon("#d8dde8"), { pos: [r, -0.15, 0] }));
    arm.rotation.y = r * 3;
    mobile.add(arm);
  }
  mobile.add(mesh(geo.cyl(0.01, 0.01, 1, 4), toon("#d8dde8"), { pos: [0, 0.6, 0] }));
  spinner(room, mobile, 0.5);
  level.interact("看看行星模型", 3.8, 2, 1.8, () =>
    ctx.say("行星模型", ["橘色的是火星，蓝色的是地球，粉色的……是一颗还没有名字的星星。", "底下的小卡片写着：「送给喜欢蓝色的人」。"]),
  );

  const chart = textPanel(["星图", "★ 猎户座", "★ 北斗七星", "★ 仙后座"], "#1c1d3a", "#FFD166", 384, 384, 40);
  poster(room, "east", -1, 2.2, chart, 1.6, 1.6, "#818CF8");
  bookshelf(room, "west", -1, 2.4, 2.6, 21);
  return room;
}

const BUILDERS: Record<HouseId, (ctx: GameContext) => Room> = {
  home,
  cafe,
  library,
  bakery,
  flower,
  music,
  arcade,
  observatory,
};

export function buildInterior(id: HouseId, ctx: GameContext): Level {
  const room = BUILDERS[id](ctx);
  mergeStatic(room.statics);
  return room.level;
}

export const INTERIOR_STAR_COUNT = HOUSES.length;
