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
  const hairCapMat = toon(C.hair, { side: THREE.DoubleSide });
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
  const hair = new THREE.Group();
  head.add(hair);
  const HR = R * 1.08;
  const opening = 2.0;
  const capTop = mesh(geo.custom("hairTop", () => new THREE.SphereGeometry(HR, 36, 10, 0, Math.PI * 2, 0, Math.PI * 0.3)), hairCapMat, {
    pos: [center.x, center.y, center.z],
    scale: [headScale.x, headScale.y, headScale.z],
  });
  const capBand = mesh(
    geo.custom("hairBand", () =>
      new THREE.SphereGeometry(HR, 36, 12, Math.PI / 2 + opening / 2, Math.PI * 2 - opening, Math.PI * 0.28, Math.PI * 0.4),
    ),
    hairCapMat,
    { pos: [center.x, center.y, center.z], scale: [headScale.x, headScale.y, headScale.z] },
  );
  hair.add(capTop, capBand);

  const up = new THREE.Vector3(0, 1, 0);
  const addStrand = (
    parent: THREE.Object3D,
    anchor: [number, number, number],
    len: number,
    radius: number,
    opts: { hang?: number; out?: number; sweep?: number; flat?: number; tip?: string; dir?: THREE.Vector3 } = {},
  ) => {
    const { p, n } = surface(anchor[0], anchor[1], anchor[2], 0.02);
    let dir: THREE.Vector3;
    if (opts.dir) {
      dir = opts.dir.clone().normalize();
    } else {
      const down = new THREE.Vector3(0, -1, 0);
      const tangent = down.clone().sub(n.clone().multiplyScalar(n.dot(down)));
      if (tangent.lengthSq() < 1e-4) tangent.set(0, 0, 1);
      tangent.normalize();
      const side = new THREE.Vector3().crossVectors(n, tangent).normalize();
      dir = tangent
        .multiplyScalar(opts.hang ?? 1)
        .add(n.clone().multiplyScalar(opts.out ?? 0.05))
        .add(side.multiplyScalar(opts.sweep ?? 0))
        .normalize();
    }
    const z = n.clone().sub(dir.clone().multiplyScalar(n.dot(dir)));
    if (z.lengthSq() < 1e-4) z.copy(up);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(dir, z);
    const m = mesh(strandGeometry(len, radius, opts.tip ?? C.hair), hairMat, { cast: true });
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, dir, z));
    m.scale.set(1, 1, opts.flat ?? 0.55);
    m.position.copy(p);
    parent.add(m);
    return m;
  };

  // Bangs sweep slightly towards the character's left, ending around the eyes.
  const bangs = new THREE.Group();
  hair.add(bangs);
  const bangDefs: Array<[number, number, number]> = [
    [-0.62, 0.3, 0.02],
    [-0.44, 0.26, 0.05],
    [-0.26, 0.22, 0.08],
    [-0.1, 0.25, 0.12],
    [0.06, 0.28, 0.1],
    [0.22, 0.22, 0.1],
    [0.38, 0.27, 0.08],
    [0.54, 0.24, 0.06],
    [0.7, 0.3, 0.02],
  ];
  for (const [x, len, sweep] of bangDefs) {
    addStrand(bangs, [x, 0.62, 0.72], len, 0.1, { hang: 1, out: -0.18, sweep, flat: 0.45 });
  }
  for (const side of [1, -1]) {
    addStrand(bangs, [0.86 * side, 0.3, 0.42], 0.4, 0.11, { out: 0.05, sweep: 0.05 * side, flat: 0.5 });
    addStrand(bangs, [0.93 * side, 0.12, 0.2], 0.44, 0.1, { out: 0.08, flat: 0.5, tip: C.hairTip });
  }

  // Wolf-cut layers at the back, ends fading to the lighter blue from the photo.
  const back = new THREE.Group();
  back.position.copy(center);
  hair.add(back);
  const backLocal = new THREE.Group();
  backLocal.position.copy(center).multiplyScalar(-1);
  back.add(backLocal);
  const backCount = 11;
  for (let i = 0; i < backCount; i++) {
    const a = Math.PI * (0.16 + (0.68 * i) / (backCount - 1));
    const x = Math.cos(a);
    const z = -Math.sin(a);
    addStrand(backLocal, [x * 0.9, -0.2, z * 0.9 - 0.05], 0.3 + Math.sin(i * 1.7) * 0.04, 0.12, {
      out: 0.3,
      flat: 0.5,
      tip: C.hairTip,
    });
    if (i % 2 === 0) {
      addStrand(backLocal, [x * 0.85, 0.2, z * 0.85], 0.4, 0.12, { out: 0.22, flat: 0.5, tip: C.hairTip });
    }
  }

  // Messy crown plus a single ahoge on top.
  const crownDirs: Array<[number, number, number]> = [
    [0.4, 0.8, -0.3],
    [-0.45, 0.78, -0.2],
    [0.1, 0.85, -0.5],
    [-0.2, 0.7, -0.68],
    [0.5, 0.55, -0.62],
    [-0.62, 0.5, -0.55],
    [0.7, 0.62, 0.1],
    [-0.72, 0.6, 0.12],
  ];
  for (const [x, y, z] of crownDirs) {
    const { n } = surface(x, y, z);
    const dir = n.clone().add(new THREE.Vector3(0, -0.25, -0.35)).normalize();
    addStrand(hair, [x, y, z], 0.2, 0.1, { dir, flat: 0.5 });
  }
  const ahoge = new THREE.Group();
  const ahogeBase = surface(0.05, 1, 0.1, 0.01).p;
  ahoge.position.copy(ahogeBase);
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
    bangs.rotation.x = hairSwing * 0.08;
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
