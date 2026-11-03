/*
 * The strongman's meshes. The hero faces +X with +Y up, so his right side is
 * +Z. Limb segments are built along +Y from their root joint; the rig aims
 * them every frame, so no skinning is needed.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { addOutline, toon, type ToonMat } from "../render/materials.ts";

export const DIM = {
  hipY: 0.95,
  hipW: 0.17,
  spineY: 0.1,
  shoulderY: 0.62,
  shoulderW: 0.44,
  neckY: 0.78,
  upperArm: 0.42,
  foreArm: 0.42,
  thigh: 0.47,
  shin: 0.46,
  ankle: 0.1,
};

export const COLORS = {
  skin: 0xf4b38a,
  skinShade: 0xd98b6a,
  singlet: 0xff6b9d,
  shorts: 0x2b2d55,
  band: 0xffd166,
  hair: 0x1a1a2e,
  boot: 0x1a1a2e,
  sole: 0xfffffe,
  wood: 0xb06f3c,
  steel: 0x3d4466,
  gold: 0xffd166,
  core: 0x5ce0d8,
};

const OUT = 0.018;

function lathe(profile: [number, number][], len: number, seg = 14) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y * len));
  return new THREE.LatheGeometry(pts, seg);
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, outline = OUT, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  if (outline > 0) addOutline(m, outline);
  parent.add(m);
  return m;
}

export interface Limb {
  /** Segment roots, aimed at the next joint each frame. */
  a: THREE.Group;
  b: THREE.Group;
  joint: THREE.Mesh;
  end: THREE.Group;
}

export interface HeroModel {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  shoulders: [THREE.Object3D, THREE.Object3D];
  hips: [THREE.Object3D, THREE.Object3D];
  arms: [Limb, Limb];
  legs: [Limb, Limb];
  face: {
    eyes: THREE.Mesh[];
    pupils: THREE.Mesh[];
    brows: THREE.Mesh[];
    mouth: THREE.Mesh;
    tails: THREE.Group[];
    sweat: THREE.Mesh;
  };
  mats: Record<"skin" | "singlet" | "shorts" | "band", ToonMat>;
}

function limb(parent: THREE.Object3D, mat: ToonMat, la: number, lb: number, pa: [number, number][], pb: [number, number][], jr: number): Limb {
  const a = new THREE.Group();
  const b = new THREE.Group();
  const end = new THREE.Group();
  parent.add(a, b, end);
  mesh(lathe(pa, la), mat, a);
  mesh(lathe(pb, lb), mat, b);
  const joint = mesh(new THREE.SphereGeometry(jr, 14, 10), mat, parent, 0);
  return { a, b, joint, end };
}

export function buildHero(): HeroModel {
  const m = {
    skin: toon({ color: COLORS.skin, rim: 0.45, rimColor: 0xffe0c8 }),
    singlet: toon({ color: COLORS.singlet, rim: 0.4, rimColor: 0xffc4d6 }),
    shorts: toon({ color: COLORS.shorts, rim: 0.35, rimColor: 0xa78bfa }),
    band: toon({ color: COLORS.band, rim: 0.3 }),
  };
  const ink = toon({ color: COLORS.hair, rim: 0.25, rimColor: 0x818cf8 });
  const white = toon({ color: 0xfffffe, rim: 0 });
  const sole = toon({ color: COLORS.sole, rim: 0 });

  const root = new THREE.Group();
  root.name = "hero";
  const pelvis = new THREE.Group();
  pelvis.position.y = DIM.hipY;
  root.add(pelvis);
  const shorts = mesh(new THREE.SphereGeometry(0.3, 20, 14), m.shorts, pelvis);
  shorts.scale.set(0.95, 0.72, 1.08);
  const belt = mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 24), m.band, pelvis, 0.012);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.13;
  belt.scale.set(1.05, 1.18, 1);
  const buckle = mesh(new RoundedBoxGeometry(0.06, 0.1, 0.13, 2, 0.02), m.band, pelvis, 0.012);
  buckle.position.set(0.3, 0.13, 0);

  const spine = new THREE.Group();
  spine.position.y = DIM.spineY;
  pelvis.add(spine);
  // V-taper: narrow waist under a barrel chest is the strongman silhouette.
  const waist = mesh(lathe([[0.001, 0], [0.25, 0.02], [0.27, 0.25], [0.34, 0.55], [0.4, 0.8], [0.36, 0.97], [0.001, 1]], 0.66, 20), m.singlet, spine);
  waist.scale.set(0.82, 1, 1.12);
  const chest = new THREE.Group();
  chest.position.y = DIM.shoulderY;
  spine.add(chest);
  const pecs = mesh(new THREE.SphereGeometry(0.3, 20, 14), m.skin, chest, OUT);
  pecs.scale.set(0.72, 0.52, 1.35);
  pecs.position.set(0.08, -0.02, 0);
  const traps = mesh(new THREE.SphereGeometry(0.25, 16, 12), m.skin, chest);
  traps.scale.set(0.8, 0.55, 1.5);
  traps.position.set(-0.04, 0.08, 0);
  for (const z of [-1, 1]) {
    const strap = mesh(new RoundedBoxGeometry(0.42, 0.05, 0.07, 2, 0.02), m.singlet, chest, 0.01);
    strap.position.set(0.02, 0.1, z * 0.16);
    strap.rotation.z = -0.15;
  }

  const shoulders: [THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D()];
  for (const [i, z] of [[0, -1], [1, 1]] as const) {
    shoulders[i].position.set(-0.02, 0.02, z * DIM.shoulderW);
    chest.add(shoulders[i]);
    const delt = mesh(new THREE.SphereGeometry(0.15, 14, 10), m.skin, shoulders[i]);
    delt.scale.set(1, 0.9, 0.95);
  }

  const neck = new THREE.Group();
  neck.position.set(0.04, 0.12, 0);
  chest.add(neck);
  mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.2, 12), m.skin, neck, 0).position.y = 0.06;
  const head = new THREE.Group();
  head.position.y = 0.3;
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.26, 22, 16), m.skin, head);
  skull.scale.set(1, 1.04, 0.94);
  const jaw = mesh(new RoundedBoxGeometry(0.3, 0.2, 0.36, 3, 0.08), m.skin, head);
  jaw.position.set(0.07, -0.13, 0);
  const hair = mesh(new RoundedBoxGeometry(0.4, 0.15, 0.44, 3, 0.06), ink, head);
  hair.position.set(-0.03, 0.2, 0);
  hair.rotation.z = 0.12;
  const quiff = mesh(new RoundedBoxGeometry(0.16, 0.12, 0.4, 3, 0.05), ink, head);
  quiff.position.set(0.15, 0.24, 0);
  quiff.rotation.z = -0.35;
  const band = mesh(new THREE.TorusGeometry(0.262, 0.04, 8, 28), m.band, head, 0.012);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.1;
  const tails: THREE.Group[] = [];
  for (const z of [-0.05, 0.05]) {
    const t = new THREE.Group();
    t.position.set(-0.26, 0.1, z);
    head.add(t);
    const g = new RoundedBoxGeometry(0.28, 0.035, 0.07, 2, 0.015);
    g.translate(-0.14, 0, 0);
    mesh(g, m.band, t, 0.01, false);
    tails.push(t);
  }
  for (const z of [-1, 1]) mesh(new THREE.SphereGeometry(0.06, 10, 8), m.skin, head, 0.012).position.set(-0.02, 0, z * 0.25);
  mesh(new THREE.SphereGeometry(0.05, 12, 10), m.skin, head, 0.012).position.set(0.27, -0.02, 0);
  const eyes: THREE.Mesh[] = [];
  const pupils: THREE.Mesh[] = [];
  const brows: THREE.Mesh[] = [];
  for (const z of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.055, 14, 10), white, head, 0.01, false);
    e.position.set(0.215, 0.05, z * 0.095);
    e.scale.set(0.55, 1, 0.9);
    eyes.push(e);
    const p = mesh(new THREE.SphereGeometry(0.03, 10, 8), ink, e, 0, false);
    p.position.x = 0.05;
    pupils.push(p);
    const b = mesh(new RoundedBoxGeometry(0.05, 0.04, 0.13, 2, 0.015), ink, head, 0, false);
    b.position.set(0.24, 0.13, z * 0.1);
    brows.push(b);
    const stache = mesh(new THREE.SphereGeometry(0.07, 12, 8), ink, head, 0, false);
    stache.position.set(0.26, -0.085, z * 0.065);
    stache.scale.set(0.45, 0.42, 1.1);
    stache.rotation.x = z * 0.35;
  }
  const mouthMat = toon({ color: 0x6b1f3a, rim: 0 });
  const mouth = mesh(new THREE.SphereGeometry(0.06, 12, 8), mouthMat, head, 0, false);
  mouth.position.set(0.235, -0.165, 0);
  mouth.scale.set(0.4, 0.15, 1.1);
  const sweat = mesh(new THREE.SphereGeometry(0.04, 10, 8), toon({ color: 0x7dd3fc, rim: 0.8 }), head, 0.008, false);
  sweat.position.set(0.1, 0.22, 0.24);
  sweat.scale.set(0.8, 1.3, 0.8);
  sweat.visible = false;

  const armProfile: [number, number][] = [[0.001, 0], [0.1, 0.03], [0.125, 0.3], [0.135, 0.55], [0.1, 0.92], [0.001, 1]];
  // Popeye forearms: wider than the upper arm, they read from far away.
  const foreProfile: [number, number][] = [[0.001, 0], [0.085, 0.04], [0.13, 0.4], [0.14, 0.6], [0.085, 0.96], [0.001, 1]];
  const arms = [0, 1].map(() => {
    const l = limb(root, m.skin, DIM.upperArm, DIM.foreArm, armProfile, foreProfile, 0.09);
    mesh(new THREE.SphereGeometry(0.105, 14, 10), m.skin, l.end);
    const cuff = mesh(new THREE.TorusGeometry(0.085, 0.03, 8, 16), m.band, l.end, 0.01);
    cuff.position.y = -0.08;
    cuff.rotation.x = Math.PI / 2;
    return l;
  }) as [Limb, Limb];

  const hips: [THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D()];
  const legs = [-1, 1].map((z, i) => {
    hips[i].position.set(0, -0.06, z * DIM.hipW);
    pelvis.add(hips[i]);
    const l = limb(
      root,
      m.skin,
      DIM.thigh,
      DIM.shin,
      [[0.001, 0], [0.15, 0.04], [0.165, 0.35], [0.12, 0.92], [0.001, 1]],
      [[0.001, 0], [0.09, 0.05], [0.115, 0.3], [0.075, 0.92], [0.001, 1]],
      0.1,
    );
    // Shorts cuff hides where the thigh meets the pelvis.
    const cuff = mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.2, 14), m.shorts, l.a);
    cuff.position.y = 0.09;
    const boot = mesh(new RoundedBoxGeometry(0.34, 0.17, 0.2, 3, 0.07), ink, l.end);
    boot.position.set(0.07, -0.02, 0);
    const s = mesh(new RoundedBoxGeometry(0.36, 0.05, 0.21, 2, 0.02), sole, l.end, 0.01);
    s.position.set(0.07, -0.1, 0);
    return l;
  }) as [Limb, Limb];

  return { root, pelvis, spine, chest, neck, head, shoulders, hips, arms, legs, face: { eyes, pupils, brows, mouth, tails, sweat }, mats: m };
}

export interface HammerModel {
  root: THREE.Group;
  head: THREE.Group;
  core: ToonMat;
  setLength(l: number): void;
}

/**
 * The handle runs along +X from the grip; the head sits at the far end with
 * its striking face toward local -Y, the direction of the downswing.
 */
export function buildHammer(): HammerModel {
  const root = new THREE.Group();
  const wood = toon({ color: COLORS.wood, rim: 0.35, rimColor: 0xffd166 });
  const steel = toon({ color: COLORS.steel, rim: 0.7, rimColor: 0xb5f5ec });
  const gold = toon({ color: COLORS.gold, rim: 0.5, emissive: 0x3a2400 });
  const core = toon({ color: 0x1d2b3a, emissive: COLORS.core, emissiveIntensity: 0.2, rim: 0.6, rimColor: 0x7dffc7 });
  const handleGeo = new THREE.CylinderGeometry(0.045, 0.055, 1, 12);
  handleGeo.rotateZ(-Math.PI / 2);
  handleGeo.translate(0.5, 0, 0);
  const handle = mesh(handleGeo, wood, root, 0.015);
  const grip = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 12).rotateZ(-Math.PI / 2), toon({ color: 0x1a1a2e, rim: 0.3 }), root, 0.012);
  grip.position.x = 0.08;
  mesh(new THREE.SphereGeometry(0.08, 12, 10), gold, root, 0.012).position.x = -0.12;
  const head = new THREE.Group();
  root.add(head);
  const barrel = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.62, 24), steel, head, 0.025);
  for (const y of [-0.31, 0.31]) {
    const face = mesh(new THREE.CylinderGeometry(0.29, 0.27, 0.08, 24), gold, head, 0.015);
    face.position.y = y + Math.sign(y) * 0.02;
  }
  const ring = mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.16, 24), core, head, 0);
  ring.position.y = 0;
  barrel.scale.set(1, 1, 1);
  return {
    root,
    head,
    core,
    setLength(l) {
      handle.scale.x = l;
      head.position.x = l;
      // Long reaches get a bigger head so the silhouette keeps its balance.
      head.scale.setScalar(0.9 + 0.25 * Math.max(0, l - 1.4));
    },
  };
}
