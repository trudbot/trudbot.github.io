import * as THREE from "three";
import { HOUSES, type GameContext, type HouseDef, type HouseId } from "./context";
import { Level } from "./level";
import { Sprite } from "./particles";
import { buildSkyHop, SKYHOP_ZONE } from "./skyhop";
import { basic, canvasTexture, geo, group, labelFont, mergeStatic, mesh, signTexture, stripeTexture, toon } from "./toon";

export interface MinimapInfo {
  /** Centre x, centre z, width, depth. */
  roads: Array<[number, number, number, number]>;
  plaza: number;
  houses: Array<{ x: number; z: number; w: number; d: number; color: string; round: boolean; label: string }>;
  pond: { x: number; z: number; r: number };
  skyhop: { x: number; z: number; r: number };
  trees: Array<[number, number]>;
}

export interface Town {
  level: Level;
  doorways: Record<HouseId, { x: number; z: number; facing: number }>;
  minimap: MinimapInfo;
  cat: THREE.Object3D;
}

const PALETTE = ["#FF8FAB", "#FFD166", "#A78BFA", "#7DD3FC", "#FFA94D", "#5CE0D8", "#FFC4D6", "#ffffff"];
const WORLD = 56;
const ROAD = 5;
const PLAZA = 10;
const POND = { x: -38, z: -38, r: 7 };

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TownMaterials {
  window: THREE.MeshToonMaterial;
  lamp: THREE.MeshToonMaterial;
}

function footprint(def: HouseDef) {
  const quarter = Math.abs(Math.sin(def.facing)) > 0.5;
  return { w: quarter ? def.d : def.w, d: quarter ? def.w : def.d };
}

export function buildTown(ctx: GameContext): Town {
  const level = new Level({
    id: "town",
    name: "trudbot 小镇",
    indoor: false,
    bounds: { minX: -WORLD, maxX: WORLD, minZ: -WORLD, maxZ: WORLD },
    spawn: { x: 0, z: 13, facing: Math.PI },
    camera: { distance: 9, minDistance: 4, maxDistance: 18, pitch: 0.42, yaw: 0 },
  });
  const scene = level.scene;
  const statics = new THREE.Group();
  scene.add(statics);
  const rand = seeded(7);

  const mats: TownMaterials = {
    window: toon("#bfe8ff", { emissive: "#ffc46b", emissiveIntensity: 0, unique: true }),
    lamp: toon("#fff4c9", { emissive: "#ffd27a", emissiveIntensity: 0.05, unique: true }),
  };

  // ── Sky, lights, fog ──
  const sky = buildSky();
  scene.add(sky.object);
  scene.fog = new THREE.Fog("#d8f3ff", 70, 210);
  const hemi = new THREE.HemisphereLight("#eaf6ff", "#b7e3a0", 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -26;
  sc.right = sc.top = 26;
  sc.near = 1;
  sc.far = 90;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  level.sun = sun;

  const plazaLights: THREE.PointLight[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const light = new THREE.PointLight("#ffcf7a", 0, 18, 1.6);
    light.position.set(Math.cos(a) * 8.5, 3.4, Math.sin(a) * 8.5);
    scene.add(light);
    plazaLights.push(light);
  }

  const dayTop = new THREE.Color("#6ec8ff");
  const nightTop = new THREE.Color("#141a4a");
  const dayHorizon = new THREE.Color("#d8f3ff");
  const nightHorizon = new THREE.Color("#3b3570");
  const fogColor = (scene.fog as THREE.Fog).color;
  level.nightHandlers.push((k) => {
    sky.top.copy(dayTop).lerp(nightTop, k);
    sky.horizon.copy(dayHorizon).lerp(nightHorizon, k);
    fogColor.copy(sky.horizon);
    sky.setNight(k);
    hemi.color.set("#eaf6ff").lerp(new THREE.Color("#6a78c8"), k);
    hemi.groundColor.set("#b7e3a0").lerp(new THREE.Color("#28304a"), k);
    hemi.intensity = THREE.MathUtils.lerp(1.5, 0.7, k);
    sun.color.set("#fff1d6").lerp(new THREE.Color("#9fb4ff"), k);
    sun.intensity = THREE.MathUtils.lerp(2.4, 0.55, k);
    mats.lamp.emissiveIntensity = THREE.MathUtils.lerp(0.05, 1.8, k);
    mats.window.emissiveIntensity = THREE.MathUtils.lerp(0, 0.9, k);
    for (const l of plazaLights) l.intensity = THREE.MathUtils.lerp(0, 30, k);
  });

  // ── Ground, roads, plaza ──
  const grassTex = canvasTexture(256, 256, (c) => {
    c.fillStyle = "#a6de84";
    c.fillRect(0, 0, 256, 256);
    const r = seeded(3);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = r() > 0.5 ? "rgba(90,170,90,0.22)" : "rgba(230,255,200,0.25)";
      c.beginPath();
      c.ellipse(r() * 256, r() * 256, 2 + r() * 5, 1 + r() * 2, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(50, 50);
  const ground = mesh(geo.plane(420, 420), toon("#ffffff", { map: grassTex, outline: false }), {
    rot: [-Math.PI / 2, 0, 0],
    cast: false,
  });
  statics.add(ground);

  const roadMat = toon("#f3e3bf", { outline: false });
  const roadEdge = toon("#e2cc9c", { outline: false });
  const roads: MinimapInfo["roads"] = [
    [0, 0, 67, ROAD],
    [0, 0, ROAD, 67],
  ];
  const sidePaths: Array<[number, number, number, number]> = [];
  for (const h of HOUSES) {
    if (h.x !== 0 && h.z !== 0) {
      const fp = footprint(h);
      const front = Math.abs(h.z) - fp.d / 2;
      const len = front - ROAD / 2;
      sidePaths.push([h.x, Math.sign(h.z) * (ROAD / 2 + len / 2), 2.4, len]);
    }
  }
  for (const [x, z, w, d] of [...roads, ...sidePaths]) {
    statics.add(mesh(geo.box(w + 0.5, 0.04, d + 0.5, 0.02), roadEdge, { pos: [x, 0.015, z], cast: false }));
    statics.add(mesh(geo.box(w, 0.06, d, 0.02), roadMat, { pos: [x, 0.03, z], cast: false }));
  }
  roads.push(...sidePaths);

  const plazaTex = canvasTexture(512, 512, (c) => {
    c.fillStyle = "#f6e7c8";
    c.fillRect(0, 0, 512, 512);
    c.strokeStyle = "rgba(190,160,110,0.35)";
    c.lineWidth = 4;
    for (let r = 40; r < 256; r += 34) {
      c.beginPath();
      c.arc(256, 256, r, 0, Math.PI * 2);
      c.stroke();
      const n = Math.floor(r / 7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r;
        c.beginPath();
        c.moveTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r);
        c.lineTo(256 + Math.cos(a) * (r + 34), 256 + Math.sin(a) * (r + 34));
        c.stroke();
      }
    }
  });
  statics.add(mesh(geo.cyl(PLAZA + 0.4, PLAZA + 0.4, 0.06, 48), roadEdge, { pos: [0, 0.03, 0], cast: false }));
  statics.add(mesh(geo.cyl(PLAZA, PLAZA, 0.1, 48), toon("#ffffff", { map: plazaTex, outline: false }), { pos: [0, 0.05, 0], cast: false }));

  buildFountain(level, statics);

  // ── Houses ──
  const doorways = {} as Town["doorways"];
  const minimapHouses: MinimapInfo["houses"] = [];
  for (const def of HOUSES) {
    doorways[def.id] = buildHouse(level, statics, def, mats, ctx);
    const fp = footprint(def);
    minimapHouses.push({
      x: def.x,
      z: def.z,
      w: fp.w,
      d: fp.d,
      color: def.roof,
      round: def.roofType === "tower" || def.roofType === "dome",
      label: def.name,
    });
  }

  // ── Keep-out test for scattered decoration ──
  const blocked = (x: number, z: number, margin: number) => {
    if (Math.abs(x) > WORLD - 1 || Math.abs(z) > WORLD - 1) return true;
    if (Math.hypot(x, z) < PLAZA + 1.5 + margin) return true;
    for (const [rx, rz, rw, rd] of roads) {
      if (Math.abs(x - rx) < rw / 2 + 1 + margin && Math.abs(z - rz) < rd / 2 + 1 + margin) return true;
    }
    for (const h of minimapHouses) {
      if (Math.abs(x - h.x) < h.w / 2 + 2.5 + margin && Math.abs(z - h.z) < h.d / 2 + 2.5 + margin) return true;
    }
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.5 + margin) return true;
    if (Math.hypot(x - SKYHOP_ZONE.x, z - SKYHOP_ZONE.z) < SKYHOP_ZONE.r + margin) return true;
    if (x > 7 && x < 18 && z > 25 && z < 36) return true;
    if (x > 22 && x < 30 && z > -12 && z < -4) return true;
    return false;
  };

  // ── Trees & bushes ──
  const treePositions: Array<[number, number]> = [];
  let attempts = 0;
  while (treePositions.length < 58 && attempts++ < 4000) {
    const x = (rand() * 2 - 1) * (WORLD - 3);
    const z = (rand() * 2 - 1) * (WORLD - 3);
    if (blocked(x, z, 0.5)) continue;
    if (treePositions.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 4.2)) continue;
    treePositions.push([x, z]);
  }
  for (const [x, z] of treePositions) {
    const kind = rand();
    const s = 0.8 + rand() * 0.5;
    statics.add(kind < 0.3 ? pineTree(x, z, s) : roundTree(x, z, s, kind > 0.85 ? "#FFC4D6" : undefined, rand));
    level.circle(x, z, 0.45 * s);
  }
  let bushes = 0;
  attempts = 0;
  while (bushes < 34 && attempts++ < 3000) {
    const x = (rand() * 2 - 1) * (WORLD - 2);
    const z = (rand() * 2 - 1) * (WORLD - 2);
    if (blocked(x, z, -0.8)) continue;
    if (treePositions.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 2.5)) continue;
    statics.add(bush(x, z, 0.7 + rand() * 0.5, rand));
    level.circle(x, z, 0.8);
    bushes++;
  }

  // ── Instanced flowers & grass tufts (no outlines: instancing isn't supported by OutlineEffect) ──
  const flowerMesh = new THREE.InstancedMesh(geo.ico(0.13, 0), toon("#ffffff", { outline: false }), 700);
  const tuftMesh = new THREE.InstancedMesh(geo.cone(0.09, 0.32, 5), toon("#7cc766", { outline: false }), 1100);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  let fi = 0;
  let ti = 0;
  while (fi < flowerMesh.count || ti < tuftMesh.count) {
    const x = (rand() * 2 - 1) * (WORLD - 1);
    const z = (rand() * 2 - 1) * (WORLD - 1);
    if (blocked(x, z, -1.2)) continue;
    if (fi < flowerMesh.count && rand() < 0.4) {
      m4.compose(new THREE.Vector3(x, 0.14, z), q.setFromEuler(new THREE.Euler(rand(), rand() * 6, 0)), new THREE.Vector3(1, 0.6, 1));
      flowerMesh.setMatrixAt(fi, m4);
      flowerMesh.setColorAt(fi, col.set(PALETTE[Math.floor(rand() * PALETTE.length)]));
      fi++;
    } else if (ti < tuftMesh.count) {
      const s = 0.6 + rand() * 0.9;
      m4.compose(new THREE.Vector3(x, 0.12 * s, z), q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4)), new THREE.Vector3(s, s, s));
      tuftMesh.setMatrixAt(ti, m4);
      tuftMesh.setColorAt(ti, col.set(rand() > 0.5 ? "#7cc766" : "#94d677"));
      ti++;
    }
  }
  for (const im of [flowerMesh, tuftMesh]) {
    im.castShadow = false;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
  }

  // ── Lamps, benches, hedges, props ──
  const lampSpots: Array<[number, number]> = [];
  for (let s = -30; s <= 30; s += 10) {
    if (Math.abs(s) < PLAZA + 2) continue;
    lampSpots.push([s, (s / 10) % 2 === 0 ? 3.4 : -3.4], [(s / 10) % 2 === 0 ? -3.4 : 3.4, s]);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    lampSpots.push([Math.cos(a) * 8.5, Math.sin(a) * 8.5]);
  }
  for (const [x, z] of lampSpots) {
    statics.add(lampPost(x, z, mats.lamp));
    level.circle(x, z, 0.2);
  }

  const benchSpots: Array<[number, number, number]> = [
    [7.4, 5.2, -Math.PI / 2],
    [-7.4, 5.2, Math.PI / 2],
    [7.4, -5.2, -Math.PI / 2],
    [-7.4, -5.2, Math.PI / 2],
  ];
  for (const [x, z, ry] of benchSpots) {
    const b = bench();
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    statics.add(b);
    level.box(x, z, 0.7, 2.2, 0.62);
  }

  const hedgeMat = toon("#4fae6a");
  for (const [x, z, w, d] of [
    [0, -WORLD - 1, WORLD * 2 + 3, 1.6],
    [0, WORLD + 1, WORLD * 2 + 3, 1.6],
    [-WORLD - 1, 0, 1.6, WORLD * 2 + 3],
    [WORLD + 1, 0, 1.6, WORLD * 2 + 3],
  ] as const) {
    statics.add(mesh(geo.box(w, 1.7, d, 0.6), hedgeMat, { pos: [x, 0.85, z] }));
    level.box(x, z, w, d);
  }

  buildScenery(statics, rand);
  buildPond(level, statics);
  buildPlatforms(level, statics);
  buildSkyHop(level, statics, ctx);
  buildSignpost(level, statics, ctx);

  const mailbox = group(
    mesh(geo.cyl(0.08, 0.08, 1.1, 8), toon("#8a5a3c"), { pos: [0, 0.55, 0] }),
    mesh(geo.box(0.55, 0.45, 0.8, 0.2), toon("#FF6B9D"), { pos: [0, 1.25, 0] }),
    mesh(geo.box(0.06, 0.3, 0.06, 0.02), toon("#FFD166"), { pos: [0.3, 1.45, 0.15] }),
  );
  mailbox.position.set(-15.2, 0, -9.2);
  statics.add(mailbox);
  level.circle(-15.2, -9.2, 0.4);
  level.interact("看看信箱", -15.2, -9.2, 1.8, () =>
    ctx.say("一封信", [
      "「亲爱的 trudbot：欢迎来到以你命名的小镇！」",
      "「小镇里藏着好多星星，屋子里也有哦。全部找到的话……会有惊喜。」",
      "「—— 镇长 猫猫」",
    ]),
  );

  // ── Stars ──
  const starSpots: Array<[number, number, number]> = [
    [-6, 0.9, -6],
    [27, 3.3, -8],
    [-18, 0.9, -25],
    [-29, 0.9, -30],
    [-45, 0.9, 9],
    [45, 0.9, -9],
    [-43, 0.9, 43],
    [43, 0.9, -43],
    [7.4, 1.55, 5.2],
    [15, 3.35, 33],
    [0, 0.9, -24],
  ];
  starSpots.forEach(([x, y, z], i) => level.addStar(`town-${i}`, x, y, z));

  // ── Living things ──
  const cat = buildCat(level, ctx);
  buildButterflies(level, rand);
  buildClouds(level, rand);

  level.updaters.push((dt) => {
    const k = sky.nightAmount();
    if (k > 0.3 && Math.random() < dt * 14 * k) {
      const p = ctx.playerPosition();
      level.glow.emit({
        pos: { x: p.x + (Math.random() - 0.5) * 30, y: 0.6 + Math.random() * 2.4, z: p.z + (Math.random() - 0.5) * 30 },
        colors: ["#eaff8a", "#fff6a8"],
        size: 0.22,
        life: 3.5,
        speed: 0.4,
        sprite: Sprite.Dot,
      });
    }
  });

  mergeStatic(statics);

  return {
    level,
    doorways,
    cat,
    minimap: { roads, plaza: PLAZA, houses: minimapHouses, pond: POND, skyhop: SKYHOP_ZONE, trees: treePositions },
  };
}

// ─── Sky ────────────────────────────────────────────────────────────────────

function buildSky() {
  const top = new THREE.Color("#6ec8ff");
  const horizon = new THREE.Color("#d8f3ff");
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTop: { value: top }, uHorizon: { value: horizon } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uHorizon, uTop, pow(h, 0.55)), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  skyMat.userData.outlineParameters = { visible: false };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(360, 32, 16), skyMat);
  dome.renderOrder = -10;

  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  const r = seeded(11);
  for (let i = 0; i < starCount; i++) {
    const theta = r() * Math.PI * 2;
    const y = 0.08 + r() * 0.92;
    const rad = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(theta) * rad * 330, y * 330, Math.sin(theta) * rad * 330], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: "#fff8e0", size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);

  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 12), new THREE.MeshBasicMaterial({ color: "#fff3b0", fog: false, transparent: true }));
  sunDisc.position.set(160, 190, 120);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(10, 20, 12), new THREE.MeshBasicMaterial({ color: "#fff6d8", fog: false, transparent: true, opacity: 0 }));
  moon.position.set(-150, 160, -170);
  for (const m of [sunDisc, moon]) m.material.userData.outlineParameters = { visible: false };

  const object = new THREE.Group();
  object.add(dome, stars, sunDisc, moon);
  let night = 0;
  return {
    object,
    top,
    horizon,
    setNight(k: number) {
      night = k;
      starMat.opacity = k;
      moon.material.opacity = k;
      sunDisc.material.opacity = 1 - k;
    },
    nightAmount: () => night,
  };
}

// ─── Houses ─────────────────────────────────────────────────────────────────

function buildHouse(level: Level, statics: THREE.Group, def: HouseDef, mats: TownMaterials, ctx: GameContext) {
  const g = new THREE.Group();
  g.position.set(def.x, 0, def.z);
  g.rotation.y = def.facing;
  statics.add(g);
  g.updateMatrixWorld(true);

  const { w, d } = def;
  const round = def.roofType === "tower" || def.roofType === "dome";
  const H = def.roofType === "tower" ? 6.2 : 4.4;
  const base = 0.4;
  const top = base + H;
  // Flat door/sign parts on a round wall need to stand proud of the curve.
  const front = d / 2 + (round ? 0.25 : 0);
  const white = toon("#fffaf0");
  const stone = toon("#d9d2c3");
  const trim = toon(def.trim);
  const roofMat = toon(def.roof);
  const keep = <T extends THREE.Object3D>(o: T) => {
    o.userData.keep = true;
    level.cameraBlockers.push(o);
    g.add(o);
    return o;
  };

  // Body
  if (round) {
    g.add(mesh(geo.cyl(w / 2 + 0.4, w / 2 + 0.5, 0.45, 40), stone, { pos: [0, 0.22, 0] }));
    const wallMat =
      def.roofType === "dome"
        ? toon("#ffffff", { map: stripeTexture(def.wall, "#FF8FAB", 28) })
        : toon(def.wall);
    keep(mesh(geo.cyl(w / 2, w / 2 + 0.25, H, 40), wallMat, { pos: [0, base + H / 2, 0] }));
    g.add(mesh(geo.torus(w / 2 + 0.05, 0.16, Math.PI * 2, 8, 48), trim, { pos: [0, top, 0], rot: [Math.PI / 2, 0, 0] }));
  } else {
    g.add(mesh(geo.box(w + 0.5, 0.45, d + 0.5, 0.12), stone, { pos: [0, 0.22, 0] }));
    keep(mesh(geo.box(w, H, d, 0.2), toon(def.wall), { pos: [0, base + H / 2, 0] }));
    g.add(mesh(geo.box(w + 0.3, 0.3, d + 0.3, 0.1), trim, { pos: [0, top, 0] }));
  }

  // Door
  g.add(mesh(geo.box(1.9, 2.6, 0.2, 0.08), white, { pos: [0, base + 1.3, front + 0.02] }));
  g.add(mesh(geo.box(1.5, 2.3, 0.2, 0.08), toon(def.door), { pos: [0, base + 1.15, front + 0.1] }));
  g.add(mesh(geo.sphere(0.09, 12, 8), toon("#FFD166"), { pos: [0.5, base + 1.1, front + 0.24] }));
  g.add(mesh(geo.cyl(0.28, 0.28, 0.06, 20), mats.window, { pos: [0, base + 1.8, front + 0.2], rot: [Math.PI / 2, 0, 0] }));
  const steps = mesh(geo.box(2.6, 0.25, 1.1, 0.06), stone, { pos: [0, 0.125, front + 0.65] });
  g.add(steps);
  g.add(mesh(geo.box(0.12, 0.35, 0.3, 0.04), toon("#3b3f5c"), { pos: [1.3, base + 2.3, front + 0.15] }));
  g.add(mesh(geo.sphere(0.2, 14, 10), mats.lamp, { pos: [1.3, base + 2.05, front + 0.35] }));

  // Windows
  const windowAt = (x: number, y: number, z: number, ry: number, withBox: boolean) => {
    const win = group(
      mesh(geo.box(1.5, 1.5, 0.18, 0.06), white),
      mesh(geo.box(1.2, 1.2, 0.14, 0.04), mats.window, { pos: [0, 0, 0.04] }),
      mesh(geo.box(0.08, 1.2, 0.08, 0.02), white, { pos: [0, 0, 0.12] }),
      mesh(geo.box(1.2, 0.08, 0.08, 0.02), white, { pos: [0, 0, 0.12] }),
      mesh(geo.box(1.7, 0.14, 0.34, 0.05), white, { pos: [0, -0.8, 0.12] }),
    );
    if (withBox) {
      win.add(mesh(geo.box(1.4, 0.32, 0.4, 0.08), toon("#b07a4f"), { pos: [0, -1.05, 0.25] }));
      for (let i = 0; i < 5; i++) {
        win.add(mesh(geo.sphere(0.13, 10, 8), toon(PALETTE[(i + def.x) % 5 === 0 ? 1 : i % 4]), { pos: [-0.5 + i * 0.25, -0.8, 0.28] }));
      }
    }
    win.position.set(x, y, z);
    win.rotation.y = ry;
    g.add(win);
  };
  const roundWindow = (angle: number, y: number) => {
    const r = w / 2 + 0.1;
    const win = group(
      mesh(geo.cyl(0.55, 0.55, 0.1, 24), mats.window, { rot: [Math.PI / 2, 0, 0] }),
      mesh(geo.torus(0.58, 0.1, Math.PI * 2, 8, 24), white),
      mesh(geo.box(0.07, 1.1, 0.06, 0.02), white, { pos: [0, 0, 0.06] }),
    );
    win.position.set(Math.sin(angle) * r, y, Math.cos(angle) * r);
    win.rotation.y = angle;
    g.add(win);
  };
  if (round) {
    for (const a of [-0.95, 0.95, Math.PI / 2 + 0.6, -Math.PI / 2 - 0.6]) roundWindow(a, base + 2.2);
    if (def.roofType === "tower") for (const a of [-0.6, 0.6]) roundWindow(a, base + 4.6);
  } else {
    const wx = w / 2 - 1.8;
    windowAt(wx, base + 1.95, front + 0.02, 0, true);
    windowAt(-wx, base + 1.95, front + 0.02, 0, true);
    windowAt(w / 2 + 0.02, base + 2.2, 0, Math.PI / 2, false);
    windowAt(-w / 2 - 0.02, base + 2.2, 0, -Math.PI / 2, false);
  }

  // Sign
  const signY = def.awning ? base + 3.7 : base + 3.25;
  const signFront = front + (round ? 0.35 : 0.14);
  g.add(mesh(geo.box(3.6, 1.1, 0.16, 0.08), trim, { pos: [0, signY, signFront] }));
  const signTex = signTexture(def.name, def.sign, def.id === "arcade" ? "#7DFFC7" : "#14151f", def.sub);
  g.add(mesh(geo.plane(3.4, 1.06), basic("#ffffff", { map: signTex, transparent: true }), { pos: [0, signY, signFront + 0.09], cast: false }));

  if (def.awning) {
    const aw = w * 0.86;
    g.add(
      mesh(geo.box(aw, 0.08, 1.7, 0.03), toon("#ffffff", { map: stripeTexture(def.awning[0], def.awning[1], 10) }), {
        pos: [0, base + 2.85, front + (round ? 1.1 : 0.8)],
        rot: [0.32, 0, 0],
      }),
    );
    const n = Math.round(aw / 0.42);
    for (let i = 0; i < n; i++) {
      const x = -aw / 2 + (i + 0.5) * (aw / n);
      g.add(
        mesh(geo.sphere(0.21, 12, 8), toon(def.awning[i % 2]), {
          pos: [x, base + 2.5, front + (round ? 1.9 : 1.6)],
          scale: [1, 0.8, 0.5],
        }),
      );
    }
  }

  // Roof
  const roofBase = top + 0.1;
  if (def.roofType === "gable") {
    const W = w + 1.0;
    const D = d + 1.0;
    const rh = 2.6;
    const roofGeo = geo.custom(`gable${W},${D}`, () => {
      const shape = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, rh)]);
      const e = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 });
      e.translate(0, 0, -D / 2);
      return e;
    });
    keep(mesh(roofGeo, roofMat, { pos: [0, roofBase, 0] }));
    g.add(mesh(geo.cyl(0.42, 0.42, 0.08, 24), mats.window, { pos: [0, roofBase + 1.0, D / 2 + 0.14], rot: [Math.PI / 2, 0, 0] }));
    g.add(mesh(geo.torus(0.45, 0.08, Math.PI * 2, 8, 24), white, { pos: [0, roofBase + 1.0, D / 2 + 0.17] }));
    if (def.chimney) {
      const cx = w * 0.28;
      const cz = -d * 0.2;
      g.add(mesh(geo.box(0.8, 2.2, 0.8, 0.1), toon("#c9716a"), { pos: [cx, roofBase + 1.55, cz] }));
      g.add(mesh(geo.box(1.0, 0.22, 1.0, 0.08), toon("#8f4d49"), { pos: [cx, roofBase + 2.7, cz] }));
      const smokeAt = g.localToWorld(new THREE.Vector3(cx, roofBase + 3, cz));
      let acc = 0;
      level.updaters.push((dt) => {
        acc += dt;
        if (acc < 0.28) return;
        acc = 0;
        level.fx.emit({ pos: smokeAt, spread: 0.3, vel: [0.35, 1.1, 0.1], speed: 0.2, colors: ["#ffffff", "#eeeeee"], size: 1.1, life: 3.2, grow: true });
      });
    }
    if (def.id === "library") {
      for (const x of [-2.3, 2.3]) {
        g.add(mesh(geo.cyl(0.32, 0.36, H, 16), white, { pos: [x, base + H / 2, front + 0.6] }));
        level.circle(...rotateLocal(def, x, front + 0.6), 0.4);
      }
    }
  } else if (def.roofType === "pyramid") {
    const pyr = geo.custom("pyramid", () => {
      const c = new THREE.ConeGeometry(1, 1, 4, 1);
      c.rotateY(Math.PI / 4);
      c.translate(0, 0.5, 0);
      return c;
    });
    keep(mesh(pyr, roofMat, { pos: [0, roofBase, 0], scale: [(w + 1.4) / Math.SQRT2, 3.4, (d + 1.4) / Math.SQRT2] }));
    g.add(mesh(geo.sphere(0.32), toon("#FFD166"), { pos: [0, roofBase + 3.45, 0] }));
    const noteAt = g.localToWorld(new THREE.Vector3(0, base + 3.5, front + 1));
    let acc = 0;
    level.updaters.push((dt) => {
      acc += dt;
      if (acc < 0.7) return;
      acc = 0;
      level.glow.emit({ pos: noteAt, spread: 2.5, vel: [0, 0.8, 0], speed: 0.3, colors: ["#A78BFA", "#7DD3FC", "#FF8FAB"], size: 0.7, life: 2.5, sprite: Sprite.Note });
    });
  } else if (def.roofType === "dome") {
    const dome = geo.custom("dome", () => new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2));
    keep(mesh(dome, roofMat, { pos: [0, roofBase - 0.2, 0], scale: [w / 2 + 0.5, 3.2, d / 2 + 0.5] }));
    g.add(mesh(geo.torus(w / 2 + 0.45, 0.34, Math.PI * 2, 10, 56), white, { pos: [0, roofBase - 0.05, 0], rot: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const len = 0.25 + ((i * 7) % 3) * 0.12;
      g.add(mesh(geo.capsule(0.17, len), white, { pos: [Math.sin(a) * (w / 2 + 0.6), roofBase - 0.35 - len / 2, Math.cos(a) * (w / 2 + 0.6)] }));
    }
    const sprinkle = geo.capsule(0.06, 0.22);
    const r = seeded(5);
    for (let i = 0; i < 36; i++) {
      const phi = r() * Math.PI * 2;
      const theta = 0.15 + r() * 1.2;
      const p = new THREE.Vector3(Math.sin(theta) * Math.cos(phi) * (w / 2 + 0.55), Math.cos(theta) * 3.25 + roofBase - 0.2, Math.sin(theta) * Math.sin(phi) * (d / 2 + 0.55));
      g.add(mesh(sprinkle, toon(PALETTE[i % 6]), { pos: [p.x, p.y, p.z], rot: [r() * 3, r() * 3, r() * 3], cast: false }));
    }
    g.add(mesh(geo.sphere(0.6), toon("#e63950"), { pos: [0, roofBase + 3.4, 0] }));
    g.add(mesh(geo.cyl(0.05, 0.07, 0.8, 6), toon("#4f8a3a"), { pos: [0.2, roofBase + 4.1, 0], rot: [0, 0, -0.4] }));
  } else if (def.roofType === "flat") {
    keep(mesh(geo.box(w + 0.6, 0.45, d + 0.6, 0.12), roofMat, { pos: [0, top + 0.2, 0] }));
    buildArcadeNeon(level, g, def, top);
  } else if (def.roofType === "tower") {
    keep(mesh(geo.custom("towerDome", () => new THREE.SphereGeometry(w / 2 + 0.25, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2)), roofMat, { pos: [0, top, 0] }));
    const R = w / 2 + 0.25;
    g.add(mesh(geo.box(1.0, 2.6, 0.35, 0.1), toon("#2e3066"), { pos: [0, top + R * 0.72, R * 0.68], rot: [-Math.PI / 4, 0, 0] }));
    g.add(mesh(geo.cyl(0.35, 0.45, 3.2, 16), toon("#4c4f9a"), { pos: [0, top + R * 0.95, R * 0.75], rot: [Math.PI / 4, 0, 0] }));
    g.add(mesh(geo.torus(0.38, 0.09, Math.PI * 2, 8, 20), toon("#FFD166"), { pos: [0, top + R * 0.95 + 1.1, R * 0.75 + 1.1], rot: [-Math.PI / 4, 0, 0] }));
  }

  // Colliders and doorway
  g.updateMatrixWorld(true);
  if (round) level.circle(def.x, def.z, w / 2 + 0.45);
  else {
    const fp = footprint(def);
    level.box(def.x, def.z, fp.w + 0.5, fp.d + 0.5);
  }
  level.colliderFrom(steps, 0.25);

  const [ix, iz] = rotateLocal(def, 0, front + 1.7);
  level.interact(`进入 ${def.name}`, ix, iz, 1.9, () => ctx.enterHouse(def.id));
  const [ox, oz] = rotateLocal(def, 0, front + 3.8);
  return { x: ox, z: oz, facing: def.facing };
}

function rotateLocal(def: HouseDef, lx: number, lz: number): [number, number] {
  const c = Math.cos(def.facing);
  const s = Math.sin(def.facing);
  return [def.x + lx * c + lz * s, def.z - lx * s + lz * c];
}

function buildArcadeNeon(level: Level, g: THREE.Group, def: HouseDef, top: number) {
  const pink = toon("#FF6B9D", { emissive: "#FF6B9D", emissiveIntensity: 1.1 });
  const cyan = toon("#5CE0D8", { emissive: "#5CE0D8", emissiveIntensity: 1.1 });
  const front = def.d / 2;
  g.add(mesh(geo.box(def.w + 0.2, 0.14, 0.14, 0.05), pink, { pos: [0, top - 0.25, front + 0.12], cast: false }));
  for (const x of [-1.1, 1.1]) g.add(mesh(geo.box(0.12, 2.7, 0.12, 0.04), cyan, { pos: [x, 0.4 + 1.35, front + 0.14], cast: false }));

  const board = new THREE.Group();
  board.position.set(0, top + 1.7, front - 1.2);
  g.add(board);
  board.add(mesh(geo.box(6.6, 2.2, 0.35, 0.12), toon("#1c1d3a")));
  const neonTex = canvasTexture(640, 200, (c) => {
    c.fillStyle = "#1c1d3a";
    c.fillRect(0, 0, 640, 200);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = labelFont(130, 900);
    c.shadowColor = "#FF6B9D";
    c.shadowBlur = 26;
    c.fillStyle = "#ffd1e0";
    c.fillText("GAME", 320, 104);
    c.shadowColor = "#5CE0D8";
    c.lineWidth = 5;
    c.strokeStyle = "#5CE0D8";
    c.strokeText("GAME", 320, 104);
  });
  board.add(mesh(geo.plane(6.2, 1.94), basic("#ffffff", { map: neonTex }), { pos: [0, 0, 0.18], cast: false }));
  board.add(mesh(geo.cyl(0.08, 0.08, 1.4, 6), toon("#3b3f5c"), { pos: [-2.4, -1.5, -0.1] }));
  board.add(mesh(geo.cyl(0.08, 0.08, 1.4, 6), toon("#3b3f5c"), { pos: [2.4, -1.5, -0.1] }));

  const bulbA = toon("#FFD166", { emissive: "#FFD166", emissiveIntensity: 1.2, unique: true });
  const bulbB = toon("#FFD166", { emissive: "#FFD166", emissiveIntensity: 0.1, unique: true });
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const edge = t * 2 * (6.6 + 2.2);
    let x: number;
    let y: number;
    if (edge < 6.6) [x, y] = [-3.3 + edge, 1.1];
    else if (edge < 8.8) [x, y] = [3.3, 1.1 - (edge - 6.6)];
    else if (edge < 15.4) [x, y] = [3.3 - (edge - 8.8), -1.1];
    else [x, y] = [-3.3, -1.1 + (edge - 15.4)];
    board.add(mesh(geo.sphere(0.1, 8, 6), i % 2 ? bulbA : bulbB, { pos: [x, y, 0.2], cast: false }));
  }
  let acc = 0;
  level.updaters.push((dt) => {
    acc += dt;
    if (acc < 0.35) return;
    acc = 0;
    const t = bulbA.emissiveIntensity;
    bulbA.emissiveIntensity = bulbB.emissiveIntensity;
    bulbB.emissiveIntensity = t;
  });
}

// ─── Props ──────────────────────────────────────────────────────────────────

function roundTree(x: number, z: number, s: number, tint: string | undefined, rand: () => number) {
  const leafColors = tint ? [tint, "#FF8FAB", "#ffd6e2"] : ["#6fcf6a", "#8ee07a", "#5bbf73"];
  const t = group(mesh(geo.cyl(0.22, 0.32, 1.6, 10), toon("#9a6b47"), { pos: [0, 0.8, 0] }));
  const blobs: Array<[number, number, number, number]> = [
    [0, 2.3, 0, 1.25],
    [0.6, 1.9, 0.3, 0.85],
    [-0.55, 2.0, -0.2, 0.9],
    [0.1, 2.95, -0.1, 0.8],
  ];
  blobs.forEach(([bx, by, bz, r], i) => {
    t.add(mesh(geo.ico(r, 2), toon(leafColors[i % leafColors.length]), { pos: [bx, by, bz], rot: [rand(), rand(), 0] }));
  });
  if (!tint && rand() > 0.6) {
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      t.add(mesh(geo.sphere(0.12, 10, 8), toon("#ff6b6b"), { pos: [Math.cos(a) * 1.1, 1.8 + rand() * 0.8, Math.sin(a) * 1.1], cast: false }));
    }
  }
  t.position.set(x, 0, z);
  t.scale.setScalar(s);
  t.rotation.y = rand() * Math.PI * 2;
  return t;
}

function pineTree(x: number, z: number, s: number) {
  const t = group(mesh(geo.cyl(0.18, 0.26, 1.2, 8), toon("#8a5a3c"), { pos: [0, 0.6, 0] }));
  const green = toon("#3fa66b");
  const light = toon("#55bf7d");
  t.add(mesh(geo.cone(1.4, 1.8, 10), green, { pos: [0, 1.6, 0] }));
  t.add(mesh(geo.cone(1.1, 1.6, 10), light, { pos: [0, 2.4, 0] }));
  t.add(mesh(geo.cone(0.75, 1.3, 10), green, { pos: [0, 3.15, 0] }));
  t.position.set(x, 0, z);
  t.scale.setScalar(s);
  return t;
}

function bush(x: number, z: number, s: number, rand: () => number) {
  const b = new THREE.Group();
  const mat = toon(rand() > 0.5 ? "#5fbf6a" : "#6ccb74");
  b.add(mesh(geo.sphere(0.7, 14, 10), mat, { pos: [0, 0.45, 0] }));
  b.add(mesh(geo.sphere(0.5, 14, 10), mat, { pos: [0.6, 0.35, 0.1] }));
  b.add(mesh(geo.sphere(0.45, 14, 10), mat, { pos: [-0.5, 0.32, -0.2] }));
  if (rand() > 0.4) {
    const c = toon(PALETTE[Math.floor(rand() * 4)]);
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      b.add(mesh(geo.sphere(0.1, 8, 6), c, { pos: [Math.cos(a) * 0.62, 0.55 + rand() * 0.4, Math.sin(a) * 0.62], cast: false }));
    }
  }
  b.position.set(x, 0, z);
  b.scale.setScalar(s);
  return b;
}

function lampPost(x: number, z: number, lampMat: THREE.Material) {
  const dark = toon("#3b3f5c");
  const l = group(
    mesh(geo.cyl(0.22, 0.28, 0.3, 10), dark, { pos: [0, 0.15, 0] }),
    mesh(geo.cyl(0.07, 0.09, 3.1, 8), dark, { pos: [0, 1.7, 0] }),
    mesh(geo.sphere(0.3, 16, 12), lampMat, { pos: [0, 3.45, 0] }),
    mesh(geo.cone(0.38, 0.35, 12), dark, { pos: [0, 3.85, 0] }),
    mesh(geo.sphere(0.08, 8, 6), dark, { pos: [0, 4.05, 0] }),
  );
  l.position.set(x, 0, z);
  return l;
}

function bench() {
  const wood = toon("#c98a5a");
  const iron = toon("#4a4e69");
  const b = group(
    mesh(geo.box(0.6, 0.12, 2.2, 0.04), wood, { pos: [0, 0.55, 0] }),
    mesh(geo.box(0.1, 0.5, 2.2, 0.04), wood, { pos: [-0.3, 0.9, 0] }),
  );
  for (const z of [-0.9, 0.9]) {
    b.add(mesh(geo.box(0.55, 0.5, 0.08, 0.02), iron, { pos: [0, 0.27, z] }));
    b.add(mesh(geo.box(0.08, 0.6, 0.08, 0.02), iron, { pos: [-0.3, 0.8, z] }));
  }
  return b;
}

function buildFountain(level: Level, statics: THREE.Group) {
  const stone = toon("#e9e3d6");
  const water = toon("#7DD3FC", { emissive: "#5CE0D8", emissiveIntensity: 0.25, transparent: true, opacity: 0.85, outline: false });
  statics.add(mesh(geo.cyl(3.3, 3.5, 0.7, 40), stone, { pos: [0, 0.35, 0] }));
  statics.add(mesh(geo.torus(3.15, 0.28, Math.PI * 2, 10, 48), stone, { pos: [0, 0.72, 0], rot: [Math.PI / 2, 0, 0] }));
  statics.add(mesh(geo.cyl(2.9, 2.9, 0.05, 40), water, { pos: [0, 0.66, 0], cast: false }));
  statics.add(mesh(geo.cyl(0.35, 0.5, 1.8, 16), stone, { pos: [0, 1.3, 0] }));
  statics.add(mesh(geo.cyl(1.3, 0.45, 0.45, 24), stone, { pos: [0, 2.1, 0] }));
  statics.add(mesh(geo.cyl(1.15, 1.15, 0.05, 24), water, { pos: [0, 2.3, 0], cast: false }));
  statics.add(mesh(geo.sphere(0.3, 14, 10), toon("#FFD166"), { pos: [0, 2.55, 0] }));
  level.circle(0, 0, 3.5);
  const spout = new THREE.Vector3(0, 2.7, 0);
  level.updaters.push((dt) => {
    level.fx.emit({ pos: spout, count: Math.ceil(dt * 90), spread: 0.15, vel: [0, 4.2, 0], speed: 1.4, colors: ["#bfefff", "#ffffff", "#7DD3FC"], size: 0.2, life: 0.9, gravity: 9 });
    if (Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      level.fx.emit({ pos: { x: Math.cos(a) * 1.3, y: 2.25, z: Math.sin(a) * 1.3 }, colors: ["#bfefff"], size: 0.16, life: 0.5, gravity: 9, vel: [Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6] });
    }
  });
}

function buildPond(level: Level, statics: THREE.Group) {
  const { x, z, r } = POND;
  statics.add(mesh(geo.cyl(r + 0.9, r + 1.1, 0.08, 40), toon("#f1dfb4", { outline: false }), { pos: [x, 0.04, z], cast: false }));
  statics.add(mesh(geo.cyl(r, r, 0.1, 40), toon("#67c7ee", { emissive: "#7DD3FC", emissiveIntensity: 0.2, outline: false }), { pos: [x, 0.08, z], cast: false }));
  const rand = seeded(21);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const d = 1.5 + rand() * (r - 2.5);
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    statics.add(mesh(geo.cyl(0.55, 0.55, 0.04, 14), toon("#5bbf73"), { pos: [px, 0.15, pz], cast: false }));
    if (i % 3 === 0) statics.add(mesh(geo.sphere(0.16, 10, 8), toon("#FFC4D6"), { pos: [px + 0.1, 0.25, pz], cast: false }));
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.3;
    statics.add(mesh(geo.ico(0.35 + rand() * 0.4, 0), toon(rand() > 0.5 ? "#b9b4ad" : "#cfc9c0"), { pos: [x + Math.cos(a) * (r + 0.6), 0.15, z + Math.sin(a) * (r + 0.6)], rot: [rand(), rand(), rand()] }));
  }
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    statics.add(mesh(geo.cyl(0.04, 0.05, 1.3, 5), toon("#7aa35a"), { pos: [x + Math.cos(a) * (r - 0.3), 0.65, z + Math.sin(a) * (r - 0.3)] }));
    statics.add(mesh(geo.capsule(0.09, 0.28), toon("#8a5a3c"), { pos: [x + Math.cos(a) * (r - 0.3), 1.35, z + Math.sin(a) * (r - 0.3)] }));
  }
  level.circle(x, z, r - 0.3);

  const ducks: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const duck = group(
      mesh(geo.sphere(0.35, 14, 10), toon("#FFD166"), { scale: [0.9, 0.75, 1.2] }),
      mesh(geo.sphere(0.22, 14, 10), toon("#FFD166"), { pos: [0, 0.35, 0.3] }),
      mesh(geo.cone(0.08, 0.2, 8), toon("#FFA94D"), { pos: [0, 0.32, 0.55], rot: [Math.PI / 2, 0, 0] }),
      mesh(geo.sphere(0.035, 6, 6), toon("#1c1729", { outline: false }), { pos: [0.1, 0.42, 0.45] }),
      mesh(geo.sphere(0.035, 6, 6), toon("#1c1729", { outline: false }), { pos: [-0.1, 0.42, 0.45] }),
      mesh(geo.cone(0.12, 0.25, 6), toon("#FFD166"), { pos: [0, 0.15, -0.42], rot: [-2.2, 0, 0] }),
    );
    duck.scale.setScalar(i === 0 ? 1.2 : 0.75);
    level.scene.add(duck);
    ducks.push(duck);
  }
  level.updaters.push((_, t) => {
    ducks.forEach((duck, i) => {
      const a = t * 0.25 + i * 0.5;
      const rr = 3.4 + Math.sin(i * 2) * 0.8;
      duck.position.set(x + Math.cos(a) * rr - i * 0.1, 0.22 + Math.sin(t * 3 + i) * 0.03, z + Math.sin(a) * rr);
      duck.rotation.y = -a;
    });
  });
}

function buildPlatforms(level: Level, statics: THREE.Group) {
  const crate = toon("#d9a066");
  const crateDark = toon("#b07a4f");
  const crateAt = (x: number, y: number, z: number, s: number) => {
    statics.add(mesh(geo.box(s, s, s, 0.06), crate, { pos: [x, y + s / 2, z] }));
    statics.add(mesh(geo.box(s * 1.02, s * 0.14, s * 1.02, 0.03), crateDark, { pos: [x, y + s * 0.85, z] }));
    statics.add(mesh(geo.box(s * 1.02, s * 0.14, s * 1.02, 0.03), crateDark, { pos: [x, y + s * 0.15, z] }));
  };
  crateAt(24.3, 0, -8, 0.7);
  level.box(24.3, -8, 0.7, 0.7, 0.7);
  crateAt(25.5, 0, -8, 1.2);
  level.box(25.5, -8, 1.2, 1.2, 1.2);
  crateAt(27, 0, -8, 1.2);
  crateAt(27, 1.2, -8, 1.2);
  level.box(27, -8, 1.2, 1.2, 2.4);

  const stem = toon("#fff1d6");
  const caps = ["#FF6B9D", "#A78BFA", "#FFA94D"];
  const spots: Array<[number, number, number]> = [
    [9, 28, 0.8],
    [12, 30.5, 1.6],
    [15, 33, 2.4],
  ];
  spots.forEach(([x, z, h], i) => {
    statics.add(mesh(geo.cyl(0.35, 0.45, h, 12), stem, { pos: [x, h / 2, z] }));
    statics.add(mesh(geo.custom("mushCap", () => new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), toon(caps[i]), { pos: [x, h - 0.45, z], scale: [1.3, 0.55, 1.3] }));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + i;
      statics.add(mesh(geo.sphere(0.16, 10, 8), toon("#ffffff"), { pos: [x + Math.cos(a) * 0.75, h - 0.1, z + Math.sin(a) * 0.75], scale: [1, 0.5, 1], cast: false }));
    }
    level.circle(x, z, 1.15, h + 0.1);
  });
}

function buildSignpost(level: Level, statics: THREE.Group, ctx: GameContext) {
  const post = group(
    mesh(geo.cyl(0.1, 0.12, 2.6, 8), toon("#8a5a3c"), { pos: [0, 1.3, 0] }),
    mesh(geo.box(2.6, 0.9, 0.14, 0.08), toon("#FFD166"), { pos: [0, 2.3, 0] }),
    mesh(geo.plane(2.45, 0.77), basic("#ffffff", { map: signTexture("trudbot 小镇", "#FFEAA7", "#14151f", "TRUDBOT TOWN"), transparent: true }), { pos: [0, 2.3, 0.08], cast: false }),
  );
  post.position.set(4.6, 0, 7.2);
  post.rotation.y = -0.35;
  statics.add(post);
  level.circle(4.6, 7.2, 0.3);
  level.interact("看看告示牌", 4.6, 7.2, 1.9, () =>
    ctx.say("小镇告示牌", [
      "欢迎来到 trudbot 小镇！镇上一共藏着 20 颗星星：外面 12 颗，每间屋子里各 1 颗。",
      "走到门口按 E 可以进屋。WASD / 方向键移动，Shift 奔跑，空格跳跃，Q 挥手，R 跳舞。",
      "有些星星放在很高的地方——试试从矮的箱子和蘑菇一路跳上去吧。",
      "东南角的魔豆藤是「云端跳跳乐」，一直跳到天上就能摘到最高的那颗星星！",
    ]),
  );
}

function buildScenery(statics: THREE.Group, rand: () => number) {
  const hill = [toon("#9bd67f", { outline: false }), toon("#8ccc73", { outline: false })];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rand() * 0.2;
    const d = 78 + rand() * 25;
    const s = 14 + rand() * 16;
    statics.add(mesh(geo.sphere(1, 24, 12), hill[i % 2], { pos: [Math.cos(a) * d, -s * 0.45, Math.sin(a) * d], scale: [s * 1.4, s, s * 1.2], cast: false }));
  }
  const rock = toon("#a9b8d8", { outline: false });
  const snow = toon("#ffffff", { outline: false });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    const d = 170 + rand() * 30;
    const h = 45 + rand() * 40;
    const r = h * 0.8;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    statics.add(mesh(geo.cone(1, 1, 7), rock, { pos: [x, h / 2 - 2, z], scale: [r, h, r], cast: false, receive: false }));
    statics.add(mesh(geo.cone(1, 1, 7), snow, { pos: [x, h - 2 - h * 0.12, z], scale: [r * 0.25, h * 0.25, r * 0.25], cast: false, receive: false }));
  }
}

// ─── Creatures ──────────────────────────────────────────────────────────────

function buildCat(level: Level, ctx: GameContext) {
  const fur = toon("#FFA94D");
  const stripe = toon("#d97a2b");
  const cream = toon("#fff1d6");
  const ink = toon("#1c1729", { outline: false });
  const cat = new THREE.Group();
  const body = group(
    mesh(geo.capsule(0.2, 0.42), fur, { pos: [0, 0.36, 0], rot: [Math.PI / 2, 0, 0] }),
    mesh(geo.torus(0.2, 0.035, Math.PI, 6, 12), stripe, { pos: [0, 0.37, -0.05], rot: [0, Math.PI / 2, 0] }),
    mesh(geo.torus(0.2, 0.035, Math.PI, 6, 12), stripe, { pos: [0, 0.37, -0.2], rot: [0, Math.PI / 2, 0] }),
  );
  cat.add(body);
  const head = group(
    mesh(geo.sphere(0.24, 18, 14), fur, { scale: [1.1, 0.95, 1] }),
    mesh(geo.sphere(0.12, 12, 8), cream, { pos: [0, -0.06, 0.16], scale: [1.2, 0.8, 0.8] }),
    mesh(geo.cone(0.09, 0.18, 4), fur, { pos: [0.14, 0.22, 0], rot: [0, 0, -0.3] }),
    mesh(geo.cone(0.09, 0.18, 4), fur, { pos: [-0.14, 0.22, 0], rot: [0, 0, 0.3] }),
    mesh(geo.sphere(0.035, 8, 6), ink, { pos: [0.09, 0.03, 0.22] }),
    mesh(geo.sphere(0.035, 8, 6), ink, { pos: [-0.09, 0.03, 0.22] }),
    mesh(geo.sphere(0.025, 8, 6), toon("#FF8FAB", { outline: false }), { pos: [0, -0.03, 0.26] }),
  );
  head.position.set(0, 0.62, 0.34);
  cat.add(head);
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [
    [0.12, 0.2],
    [-0.12, 0.2],
    [0.12, -0.2],
    [-0.12, -0.2],
  ]) {
    const leg = group(mesh(geo.capsule(0.055, 0.14), fur, { pos: [0, -0.1, 0] }));
    leg.position.set(x, 0.24, z);
    cat.add(leg);
    legs.push(leg);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.42, -0.4);
  cat.add(tail);
  let seg: THREE.Object3D = tail;
  const tailSegs: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const s = group(mesh(geo.capsule(0.05, 0.1), i === 3 ? stripe : fur, { pos: [0, 0.09, 0] }));
    s.position.y = i === 0 ? 0 : 0.17;
    s.rotation.x = -0.35;
    seg.add(s);
    seg = s;
    tailSegs.push(s);
  }
  cat.position.set(6, 0, 3);
  level.scene.add(cat);

  let target = new THREE.Vector2(6, 3);
  let wait = 1;
  let sitting = false;
  let petTimer = 0;
  let phase = 0;
  const pickTarget = () => {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4.6 + Math.random() * 6.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) > 6.8 && Math.abs(z) > 3.8 && Math.abs(z) < 6.6) continue;
      target = new THREE.Vector2(x, z);
      return;
    }
  };
  level.updaters.push((dt, t) => {
    const p = cat.position;
    if (petTimer > 0) {
      petTimer -= dt;
      const player = ctx.playerPosition();
      const want = Math.atan2(player.x - p.x, player.z - p.z);
      cat.rotation.y += Math.atan2(Math.sin(want - cat.rotation.y), Math.cos(want - cat.rotation.y)) * Math.min(1, dt * 6);
      sitting = true;
    } else if (wait > 0) {
      wait -= dt;
      sitting = true;
      if (wait <= 0) pickTarget();
    } else {
      sitting = false;
      const dx = target.x - p.x;
      const dz = target.y - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) {
        wait = 2 + Math.random() * 4;
      } else {
        const step = Math.min(dist, dt * 1.3);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        const want = Math.atan2(dx, dz);
        cat.rotation.y += Math.atan2(Math.sin(want - cat.rotation.y), Math.cos(want - cat.rotation.y)) * Math.min(1, dt * 5);
        phase += dt * 9;
      }
    }
    legs.forEach((leg, i) => {
      leg.rotation.x = sitting ? (i >= 2 ? -1.2 : 0) : Math.sin(phase + (i % 2 ? Math.PI : 0) + (i >= 2 ? Math.PI / 2 : 0)) * 0.6;
    });
    body.rotation.x = sitting ? -0.35 : 0;
    body.position.y = sitting ? 0.02 : 0;
    head.position.y = sitting ? 0.7 : 0.62 + Math.abs(Math.sin(phase)) * 0.02;
    tailSegs.forEach((s, i) => {
      s.rotation.z = Math.sin(t * 2 + i * 0.6) * 0.25;
    });
    if (petTimer > 0 && Math.random() < dt * 4) {
      level.fx.emit({ pos: { x: p.x, y: 1, z: p.z }, spread: 0.4, vel: [0, 1.2, 0], speed: 0.4, colors: ["#FF6B9D", "#FF8FAB"], size: 0.35, life: 1.2, sprite: Sprite.Heart });
    }
  });

  const lines = ["喵～（小猫舒服地眯起了眼睛）", "咕噜咕噜……", "喵！（它用头蹭了蹭你的手）", "（小猫翻了个身，露出了肚皮）"];
  level.interactables.push({
    label: "摸摸小猫",
    radius: 1.7,
    pos: () => cat.position,
    action: () => {
      petTimer = 3;
      ctx.audio.play("meow");
      level.fx.emit({ pos: { x: cat.position.x, y: 1, z: cat.position.z }, count: 8, spread: 0.5, vel: [0, 1.5, 0], speed: 1, colors: ["#FF6B9D", "#FF8FAB"], size: 0.4, life: 1.4, sprite: Sprite.Heart });
      ctx.toast(lines[Math.floor(Math.random() * lines.length)]);
    },
  });
  return cat;
}

function buildButterflies(level: Level, rand: () => number) {
  const flies: Array<{ g: THREE.Group; l: THREE.Object3D; r: THREE.Object3D; cx: number; cz: number; seed: number }> = [];
  for (let i = 0; i < 10; i++) {
    const mat = toon(PALETTE[i % 6], { side: THREE.DoubleSide, outline: false });
    const wing = geo.custom("wing", () => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.bezierCurveTo(0.25, 0.3, 0.45, 0.15, 0.35, -0.05);
      s.bezierCurveTo(0.4, -0.25, 0.15, -0.3, 0, 0);
      const g = new THREE.ShapeGeometry(s);
      g.rotateX(-Math.PI / 2);
      return g;
    });
    const l = group(mesh(wing, mat, { cast: false }));
    const r = group(mesh(wing, mat, { cast: false, rot: [0, Math.PI, 0] }));
    const g = group(l, r, mesh(geo.capsule(0.025, 0.12), toon("#3b3f5c", { outline: false }), { rot: [Math.PI / 2, 0, 0], cast: false }));
    level.scene.add(g);
    const a = rand() * Math.PI * 2;
    const d = 12 + rand() * 30;
    flies.push({ g, l, r, cx: Math.cos(a) * d, cz: Math.sin(a) * d, seed: rand() * 100 });
  }
  level.updaters.push((_, t) => {
    for (const f of flies) {
      const s = t * 0.5 + f.seed;
      const x = f.cx + Math.sin(s) * 3 + Math.sin(s * 2.3) * 1.2;
      const z = f.cz + Math.cos(s * 0.8) * 3;
      const y = 1.2 + Math.sin(s * 3.1) * 0.5;
      const prev = f.g.position.clone();
      f.g.position.set(x, y, z);
      f.g.rotation.y = Math.atan2(x - prev.x, z - prev.z) - Math.PI / 2;
      const flap = Math.sin(t * 18 + f.seed) * 0.9;
      f.l.rotation.z = flap;
      f.r.rotation.z = -flap;
    }
  });
}

function buildClouds(level: Level, rand: () => number) {
  const white = toon("#ffffff");
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const n = 4 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const r = 2 + rand() * 2.5;
      c.add(mesh(geo.sphere(1, 16, 12), white, { pos: [k * 2.6 - n * 1.3, rand() * 1.5, (rand() - 0.5) * 3], scale: [r, r * 0.8, r], cast: false, receive: false }));
    }
    c.position.set((rand() * 2 - 1) * 140, 34 + rand() * 20, (rand() * 2 - 1) * 140);
    c.userData.speed = 1 + rand() * 1.5;
    level.scene.add(c);
    clouds.push(c);
  }
  level.updaters.push((dt) => {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 150) c.position.x = -150;
    }
  });
}
