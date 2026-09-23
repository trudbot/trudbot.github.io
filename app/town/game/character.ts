import * as THREE from "three";
import { canvasTexture, geo, group, mesh, toon } from "./toon";

const C = {
  skin: "#fde9e1",
  blush: "#f7a8b8",
  hairRoot: "#1560c4",
  hair: "#1f8fea",
  hairTip: "#9ad6f6",
  iris: "#2c1b26",
  irisLight: "#6a4454",
  shadow: "#c9939f",
  lash: "#1b1219",
  lips: "#b95a55",
  mouth: "#6e2630",
  sweater: "#1f2030",
  shirt: "#f8f7f2",
  pants: "#34374b",
  shoe: "#2b2433",
  sole: "#f3efe6",
};

export interface CharacterState {
  speed: number;
  running: boolean;
  grounded: boolean;
  vy: number;
  emote: "none" | "wave" | "dance";
  emoteTime: number;
}

export interface Character {
  root: THREE.Group;
  hand: THREE.Group;
  update(dt: number, t: number, s: CharacterState): void;
  land(impact: number): void;
  /** Normalised walk phase in [0, 1); callers use it to time footstep sounds. */
  stepPhase(): number;
}

function knitTexture() {
  const tex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = C.sweater;
    ctx.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 8) {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(x, 0, 3, 128);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(x + 5, 0, 2, 128);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/** Cone strand whose vertex colours fade from root to tip; +Y points from root to tip. */
function strandGeometry(len: number, radius: number, tip: string) {
  return geo.custom(`strand${len},${radius},${tip}`, () => {
    const g = new THREE.ConeGeometry(radius, len, 8, 4);
    g.rotateX(Math.PI);
    g.translate(0, len / 2, 0);
    const root = new THREE.Color(C.hairRoot);
    const mid = new THREE.Color(C.hair);
    const end = new THREE.Color(tip);
    const colors: number[] = [];
    const p = g.attributes.position;
    const col = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const t = THREE.MathUtils.clamp(p.getY(i) / len, 0, 1);
      if (t < 0.35) col.copy(root).lerp(mid, t / 0.35);
      else col.copy(mid).lerp(end, (t - 0.35) / 0.65);
      colors.push(col.r, col.g, col.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  });
}

export function createCharacter(): Character {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = toon(C.skin);
  const sweater = toon("#ffffff", { map: knitTexture() });
  const sweaterPlain = toon(C.sweater);
  const shirt = toon(C.shirt);
  const pants = toon(C.pants);
  const hairMat = toon("#ffffff", { vertexColors: true, side: THREE.DoubleSide });
  const decal = (color: string, extra: { transparent?: boolean; opacity?: number } = {}) =>
    toon(color, { outline: false, ...extra });

  // ── Legs ──
  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.1 * side, 0.4, 0);
    pivot.add(mesh(geo.capsule(0.085, 0.18), pants, { pos: [0, -0.16, 0] }));
    const shoe = group(
      mesh(geo.box(0.17, 0.11, 0.26, 0.05), toon(C.shoe), { pos: [0, 0.01, 0.03] }),
      mesh(geo.box(0.18, 0.04, 0.27, 0.02), toon(C.sole), { pos: [0, -0.04, 0.03] }),
    );
    shoe.position.set(0, -0.34, 0);
    pivot.add(shoe);
    body.add(pivot);
    return pivot;
  };
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  // ── Torso ──
  const torso = new THREE.Group();
  torso.position.y = 0.4;
  body.add(torso);
  torso.add(mesh(geo.cyl(0.19, 0.25, 0.5, 24), sweater, { pos: [0, 0.25, 0] }));
  torso.add(mesh(geo.sphere(0.25, 24, 10), sweaterPlain, { pos: [0, 0.02, 0], scale: [1, 0.3, 1] }));
  for (const side of [1, -1]) {
    torso.add(mesh(geo.sphere(0.105), sweaterPlain, { pos: [0.19 * side, 0.44, 0] }));
  }
  const vShape = new THREE.Shape();
  vShape.moveTo(-0.085, 0);
  vShape.lineTo(0.085, 0);
  vShape.lineTo(0, -0.17);
  vShape.closePath();
  const vGeo = geo.custom("vneck", () => new THREE.ExtrudeGeometry(vShape, { depth: 0.03, bevelEnabled: false }));
  torso.add(mesh(vGeo, shirt, { pos: [0, 0.49, 0.172], rot: [-0.12, 0, 0] }));
  const collarShape = new THREE.Shape();
  collarShape.moveTo(0, 0);
  collarShape.lineTo(0.13, 0.01);
  collarShape.lineTo(0.02, -0.11);
  collarShape.closePath();
  const collarGeo = geo.custom("collar", () =>
    new THREE.ExtrudeGeometry(collarShape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }),
  );
  for (const side of [1, -1]) {
    torso.add(
      mesh(collarGeo, shirt, { pos: [0.012 * side, 0.515, 0.16], rot: [-0.5, 0.25 * side, 0], scale: [side, 1, 1] }),
    );
  }
  torso.add(mesh(geo.torus(0.075, 0.028, Math.PI * 2, 8, 20), shirt, { pos: [0, 0.51, 0.005], rot: [Math.PI / 2 - 0.15, 0, 0] }));
  torso.add(mesh(geo.cyl(0.058, 0.064, 0.1, 12), skin, { pos: [0, 0.55, 0] }));

  // ── Arms ──
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.25 * side, 0.83, 0);
    const arm = new THREE.Group();
    arm.rotation.z = 0.14 * side;
    arm.add(mesh(geo.capsule(0.072, 0.2), sweater, { pos: [0, -0.15, 0] }));
    arm.add(mesh(geo.torus(0.058, 0.02, Math.PI * 2, 8, 16), shirt, { pos: [0, -0.3, 0], rot: [Math.PI / 2, 0, 0] }));
    const hand = new THREE.Group();
    hand.position.set(0, -0.36, 0);
    hand.add(mesh(geo.sphere(0.068), skin));
    arm.add(hand);
    pivot.add(arm);
    body.add(pivot);
    return { pivot, hand };
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);

  // ── Head ──
  const head = new THREE.Group();
  head.position.set(0, 0.99, 0);
  body.add(head);
  const R = 0.4;
  const center = new THREE.Vector3(0, 0.34, 0.01);
  const headScale = new THREE.Vector3(1.06, 0.97, 1);
  head.add(mesh(geo.sphere(R, 36, 26), skin, { pos: [center.x, center.y, center.z], scale: [headScale.x, headScale.y, headScale.z] }));

  const surface = (dx: number, dy: number, dz: number, lift = 0) => {
    const n = new THREE.Vector3(dx, dy, dz).normalize();
    const p = n.clone().multiplyScalar(R + lift).multiply(headScale).add(center);
    return { p, n };
  };
  const onFace = (obj: THREE.Object3D, dx: number, dy: number, dz: number, lift = 0.004) => {
    const { p, n } = surface(dx, dy, dz, lift);
    obj.position.copy(p);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    head.add(obj);
    return obj;
  };

  const eyes: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const eye = new THREE.Group();
    const disc = (r: number, sx: number, sy: number, color: string, x = 0, y = 0, z = 0) =>
      mesh(geo.sphere(r, 18, 12), decal(color), { pos: [x, y, z], scale: [sx, sy, 0.22], cast: false });
    eye.add(disc(0.1, 1.05, 0.8, C.shadow, 0.006 * side, 0.012, -0.012));
    eye.add(disc(0.068, 0.92, 1.18, C.iris, 0, 0, 0.004));
    eye.add(disc(0.045, 0.95, 1.05, C.irisLight, 0, -0.022, 0.012));
    eye.add(disc(0.026, 1, 1, C.iris, 0, -0.008, 0.02));
    eye.add(disc(0.022, 0.9, 1.1, "#ffffff", 0.024 * side, 0.034, 0.024));
    eye.add(disc(0.011, 1, 1, "#ffffff", -0.02 * side, -0.036, 0.024));
    const lash = mesh(geo.torus(0.066, 0.012, Math.PI * 0.95, 6, 16), decal(C.lash), {
      pos: [0, 0.004, 0.012],
      rot: [0, 0, Math.PI * 0.025],
      scale: [1.02, 1.28, 0.6],
      cast: false,
    });
    eye.add(lash);
    eye.add(
      mesh(geo.cone(0.018, 0.06, 6), decal(C.lash), {
        pos: [0.07 * side, 0.03, 0.012],
        rot: [0, 0, -side * 1.2],
        cast: false,
      }),
    );
    onFace(eye, 0.36 * side, -0.1, 0.92);
    eyes.push(eye);

    const brow = mesh(geo.box(0.1, 0.018, 0.02, 0.008), decal("#3a2630"), { cast: false });
    brow.rotation.z = -0.12 * side;
    onFace(group(brow), 0.35 * side, 0.2, 0.92, 0.006);

    onFace(
      mesh(geo.sphere(0.07, 16, 10), decal(C.blush, { transparent: true, opacity: 0.55 }), { scale: [1.1, 0.55, 0.15], cast: false }),
      0.58 * side,
      -0.34,
      0.76,
      0.002,
    );
  }
  onFace(mesh(geo.sphere(0.009, 8, 6), decal("#5a3a3a"), { cast: false }), -0.2, -0.2, 0.96, 0.002);
  onFace(mesh(geo.sphere(0.018, 10, 8), toon(C.skin), { cast: false }), 0, -0.23, 0.98, 0.002);
  const mouth = group(
    mesh(geo.sphere(0.05, 16, 10), decal(C.lips), { scale: [1.15, 0.6, 0.25], cast: false }),
    mesh(geo.sphere(0.03, 12, 8), decal(C.mouth), { pos: [0, -0.002, 0.008], scale: [1, 0.3, 0.2], cast: false }),
  );
  onFace(mouth, 0, -0.43, 0.9, 0.002);

  // ── Hair ──
  // One continuous shell covers the whole scalp and its lower edge is cut into
  // points, so it already reads as a choppy fringe. The locks laid over it only
  // add layering and silhouette; gaps between them land on hair, never skin.
  const hair = new THREE.Group();
  head.add(hair);
  const deg = THREE.MathUtils.degToRad;
  const TAU = Math.PI * 2;
  /** 0 over the face, 1 at the back of the head. */
  const backness = (phi: number) => Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi))) / Math.PI;
  const hash = (i: number) => {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // Angles are polar (from the crown) and azimuthal (0 = face, +π/2 = the character's left).
  // The fringe ends just above the eyes and the edge drops to the nape at the back.
  const edgeBase = (phi: number) => deg(74) + deg(48) * THREE.MathUtils.smoothstep(backness(phi), 0.1, 0.75);
  const SPIKES = 28;
  const hairEdge = (phi: number) => {
    const f = backness(phi);
    const amp = deg(7 + 9 * f);
    const u = ((((phi % TAU) + TAU) % TAU) / TAU) * SPIKES;
    const k = Math.floor(u);
    const spike = (1 - Math.abs(2 * (u - k) - 1)) ** 1.5;
    return edgeBase(phi) - amp * 0.45 + amp * spike * (0.75 + 0.5 * hash(k));
  };
  const HR = R * 1.05;
  const hairRadius = (phi: number, theta: number) => {
    const f = backness(phi);
    const v = theta / edgeBase(phi);
    const volume = (0.02 + 0.07 * f) * Math.sin(Math.min(v, 1) * Math.PI * 0.5) ** 2;
    const flare = (THREE.MathUtils.clamp(v, 0.8, 1.2) - 0.8) ** 2 * (0.2 + 0.8 * f);
    return HR * (1 + volume + flare);
  };
  const HANG = deg(108);
  const hairPoint = (phi: number, theta: number, lift = 0, out = new THREE.Vector3()) => {
    // The fringe drifts sideways as it falls, like the swept bangs in the photo.
    const sweep = (1 - backness(phi)) ** 2 * 0.22 * Math.min(1, theta / deg(80)) ** 2;
    const th = Math.min(theta, HANG);
    const r = hairRadius(phi, th) + lift;
    const p = phi + sweep;
    out.set(Math.sin(th) * Math.sin(p) * r, Math.cos(th) * r, Math.sin(th) * Math.cos(p) * r).multiply(headScale).add(center);
    if (theta > HANG) {
      // Below the ears hair falls straight down instead of wrapping under the skull.
      const extra = (theta - HANG) * R;
      const ox = out.x - center.x;
      const oz = out.z - center.z;
      const len = Math.hypot(ox, oz) || 1;
      out.x += (ox / len) * extra * 0.3;
      out.z += (oz / len) * extra * 0.3;
      out.y -= extra;
    }
    return out;
  };

  const cRoot = new THREE.Color(C.hairRoot);
  const cMid = new THREE.Color(C.hair);
  const cTip = new THREE.Color(C.hairTip);
  const hairColor = (t: number, tip: number, out: THREE.Color) => {
    if (t < 0.35) return out.copy(cRoot).lerp(cMid, t / 0.35);
    return out.copy(cMid).lerp(cTip, ((t - 0.35) / 0.65) ** 1.4 * tip);
  };

  const shellGeo = geo.custom("hairShell", () => {
    const cols = SPIKES * 8;
    const rows = 20;
    const row = rows + 1;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i <= cols; i++) {
      const phi = (i / cols) * TAU;
      const edge = hairEdge(phi);
      const tip = 0.35 + 0.65 * backness(phi);
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        hairPoint(phi, v * edge, 0, p);
        pos.push(p.x, p.y, p.z);
        hairColor(v, tip, c);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * row + j;
        const b = a + row;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // The first and last columns meet down the middle of the fringe and every
    // column meets at the crown; unify those normals so neither shows a crease.
    const n = g.attributes.normal as THREE.BufferAttribute;
    const na = new THREE.Vector3();
    const nb = new THREE.Vector3();
    for (let j = 1; j < row; j++) {
      na.fromBufferAttribute(n, j).add(nb.fromBufferAttribute(n, cols * row + j)).normalize();
      n.setXYZ(j, na.x, na.y, na.z);
      n.setXYZ(cols * row + j, na.x, na.y, na.z);
    }
    for (let i = 0; i <= cols; i++) n.setXYZ(i * row, 0, 1, 0);
    return g;
  });
  hair.add(mesh(shellGeo, hairMat));

  /** Leaf-shaped clump lying along `points`, pointed at both ends so it needs no caps. */
  const lockGeometry = (points: THREE.Vector3[], width: number, thick: number, tip: number) => {
    const ring = 6;
    const last = points.length - 1;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const T = new THREE.Vector3();
    const N = new THREE.Vector3();
    const S = new THREE.Vector3();
    const q = new THREE.Vector3();
    const c = new THREE.Color();
    points.forEach((p, i) => {
      const t = i / last;
      T.subVectors(points[Math.min(i + 1, last)], points[Math.max(i - 1, 0)]).normalize();
      N.subVectors(p, center).normalize();
      S.crossVectors(T, N).normalize();
      N.crossVectors(S, T).normalize();
      const shape = Math.sin(Math.PI * t ** 0.6);
      hairColor(t, tip, c);
      for (let k = 0; k < ring; k++) {
        const a = (k / ring) * TAU;
        q.copy(p)
          .addScaledVector(S, Math.cos(a) * width * shape)
          .addScaledVector(N, (Math.sin(a) + 0.7) * thick * shape);
        pos.push(q.x, q.y, q.z);
        col.push(c.r, c.g, c.b);
      }
    });
    for (let i = 0; i < last; i++) {
      for (let k = 0; k < ring; k++) {
        const a = i * ring + k;
        const b = i * ring + ((k + 1) % ring);
        idx.push(a, a + ring, b, b, a + ring, b + ring);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const addLock = (
    parent: THREE.Object3D,
    from: [number, number],
    to: [number, number],
    width: number,
    o: { lift?: number; thick?: number; tip?: number; flick?: number } = {},
  ) => {
    const segs = 12;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const phi = THREE.MathUtils.lerp(from[0], to[0], t);
      const theta = deg(THREE.MathUtils.lerp(from[1], to[1], t));
      pts.push(hairPoint(phi, theta, (o.lift ?? 0.004) + (o.flick ?? 0) * t ** 3));
    }
    const m = mesh(lockGeometry(pts, width, o.thick ?? 0.03, o.tip ?? 0.6), hairMat);
    parent.add(m);
    return m;
  };
  const edgeDeg = (phi: number) => THREE.MathUtils.radToDeg(hairEdge(phi));

  // Crown layer radiating from the top: the choppy wolf-cut texture.
  for (let k = 0; k < 14; k++) {
    const phi = (k / 14) * TAU + 0.15;
    addLock(hair, [phi, 3], [phi + 0.12, edgeDeg(phi) * (0.6 + hash(k + 40) * 0.22)], 0.15, { thick: 0.035, tip: 0.3 });
  }
  // Fringe clumps end on or slightly past the shell's points, so the bangs have depth.
  [-0.8, -0.55, -0.3, -0.06, 0.18, 0.42, 0.66, 0.9].forEach((phi, k) => {
    addLock(hair, [phi * 0.5 + 0.2, 20], [phi, edgeDeg(phi) + 1 + hash(k + 7) * 2.5], 0.1 + hash(k) * 0.035, {
      thick: 0.03,
      tip: 0.25,
      lift: 0.008,
    });
  });
  // Long locks framing the face, as in the photo.
  for (const side of [1, -1]) {
    addLock(hair, [side * 1.0, 35], [side * 0.82, 128], 0.13, { thick: 0.035, tip: 0.9, flick: 0.02 });
    addLock(hair, [side * 1.3, 40], [side * 1.18, 122], 0.14, { thick: 0.035, tip: 0.9, flick: 0.03 });
  }
  // Layers over the back of the shell.
  for (let k = 0; k < 8; k++) {
    const phi = Math.PI * (0.55 + (0.9 * k) / 7);
    addLock(hair, [phi, 30], [phi + 0.05, 112 + hash(k + 20) * 10], 0.16, { thick: 0.04, tip: 0.8, flick: 0.03 });
  }
  // The mullet at the nape hangs from its own pivot so it can swing without sliding over the shell.
  const napePivot = hairPoint(Math.PI, deg(100));
  const back = new THREE.Group();
  back.position.copy(napePivot);
  hair.add(back);
  const backLocal = new THREE.Group();
  backLocal.position.copy(napePivot).negate();
  back.add(backLocal);
  for (let k = 0; k < 9; k++) {
    const phi = Math.PI * (0.62 + (0.76 * k) / 8);
    addLock(backLocal, [phi, 92], [phi + (hash(k) - 0.5) * 0.2, 132 + hash(k + 60) * 12], 0.15, { thick: 0.04, tip: 1, flick: 0.06 });
  }

  const ahoge = new THREE.Group();
  ahoge.position.copy(hairPoint(0.1, deg(8), -0.01));
  hair.add(ahoge);
  const ahogeGeo = strandGeometry(0.2, 0.035, C.hair);
  const a1 = mesh(ahogeGeo, hairMat, { rot: [0.5, 0, 0.2] });
  ahoge.add(a1);
  const a2 = mesh(ahogeGeo, hairMat, { pos: [-0.04, 0.17, 0.09], rot: [1.8, 0, 0.1], scale: [0.8, 0.7, 0.8] });
  ahoge.add(a2);

  // ── Animation state ──
  let walkPhase = 0;
  let blinkTimer = 2;
  let blink = 0;
  let squash = 0;
  let hairSwing = 0;
  let hairVel = 0;
  let lean = 0;

  const update = (dt: number, t: number, s: CharacterState) => {
    const amp = THREE.MathUtils.clamp(s.speed / 7, 0, 1);
    if (s.grounded) walkPhase += dt * (4 + s.speed * 1.6);
    const sw = Math.sin(walkPhase);
    const airborne = !s.grounded;
    const damp = (cur: number, target: number, rate: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

    let legLx = sw * 0.95 * amp;
    let legRx = -sw * 0.95 * amp;
    let armLx = -sw * 0.9 * amp;
    let armRx = sw * 0.9 * amp;
    let armLz = 0;
    let armRz = 0;
    let bodyY = Math.abs(Math.cos(walkPhase)) * 0.07 * amp + Math.sin(t * 2.2) * 0.008;
    let bodyYaw = 0;
    let headTilt = sw * 0.05 * amp;
    let headNod = 0;

    if (airborne) {
      const rising = s.vy > 0 ? 1 : 0.6;
      legLx = -0.7 * rising;
      legRx = 0.35;
      armLz = 1.1 * rising;
      armRz = -1.1 * rising;
      armLx = -0.3;
      armRx = -0.3;
      bodyY = 0;
    }

    if (s.emote === "wave") {
      armRz = -2.5;
      armRx = Math.sin(s.emoteTime * 14) * 0.35;
      headTilt = 0.15;
    } else if (s.emote === "dance") {
      const b = s.emoteTime * 7;
      bodyY = Math.abs(Math.sin(b)) * 0.12;
      bodyYaw = Math.sin(b * 0.5) * 0.5;
      armLz = 2.2 + Math.sin(b) * 0.5;
      armRz = -2.2 + Math.sin(b) * 0.5;
      armLx = 0;
      armRx = 0;
      legLx = Math.max(0, Math.sin(b)) * 0.6;
      legRx = Math.max(0, -Math.sin(b)) * 0.6;
      headTilt = Math.sin(b) * 0.2;
      headNod = Math.cos(b * 2) * 0.08;
    }

    legL.rotation.x = damp(legL.rotation.x, legLx, 18);
    legR.rotation.x = damp(legR.rotation.x, legRx, 18);
    armL.pivot.rotation.x = damp(armL.pivot.rotation.x, armLx, 16);
    armR.pivot.rotation.x = damp(armR.pivot.rotation.x, armRx, 16);
    armL.pivot.rotation.z = damp(armL.pivot.rotation.z, armLz, 12);
    armR.pivot.rotation.z = damp(armR.pivot.rotation.z, armRz, 12);
    body.position.y = damp(body.position.y, bodyY, 20);
    body.rotation.y = damp(body.rotation.y, bodyYaw, 10);
    lean = damp(lean, amp * (s.running ? 0.2 : 0.1), 8);
    body.rotation.x = lean;
    head.rotation.z = damp(head.rotation.z, headTilt, 10);
    head.rotation.x = damp(head.rotation.x, -lean * 0.6 + headNod, 10);

    squash = damp(squash, 0, 9);
    const stretch = airborne ? THREE.MathUtils.clamp(s.vy * 0.015, -0.06, 0.08) : 0;
    body.scale.set(1 + squash * 0.22 - stretch, 1 - squash * 0.28 + stretch * 1.5, 1 + squash * 0.22 - stretch);

    // Damped spring so the hair trails behind motion and bounces on landing.
    const targetSwing = -amp * 0.35 - THREE.MathUtils.clamp(s.vy, -8, 8) * 0.03;
    hairVel += ((targetSwing - hairSwing) * 90 - hairVel * 9) * dt;
    hairSwing += hairVel * dt;
    back.rotation.x = -hairSwing * 0.6;
    ahoge.rotation.x = hairSwing * 0.9 + Math.sin(t * 3) * 0.05;
    ahoge.rotation.z = Math.sin(walkPhase) * 0.15 * amp;

    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blink = 1;
      blinkTimer = 2 + Math.random() * 3;
    }
    blink = Math.max(0, blink - dt * 7);
    const open = blink > 0 ? Math.abs(blink * 2 - 1) : 1;
    for (const eye of eyes) eye.scale.y = Math.max(0.08, open);
  };

  return {
    root,
    hand: armR.hand,
    update,
    land(impact: number) {
      squash = Math.min(1, squash + impact);
    },
    stepPhase() {
      return ((walkPhase / Math.PI) % 1 + 1) % 1;
    },
  };
}
