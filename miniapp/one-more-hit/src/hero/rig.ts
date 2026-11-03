/*
 * Procedural animation for the strongman. Every state produces a target
 * Pose; the applied pose either snaps to it (the strike, which must be exact)
 * or springs toward it, so any state can flow into any other. Limbs are then
 * solved with two-bone IK: hands always stay on the hammer grip, feet stay on
 * their marks.
 */
import * as THREE from "three";
import { clamp, damp, easeIn, easeOut, lerp, noise3, smooth } from "../render/util.ts";
import { buildHammer, buildHero, DIM, type HammerModel, type HeroModel, type Limb } from "./model.ts";
import { Trail } from "./trail.ts";

const KEYS = [
  "x", "y", "lean", "bend", "twist", "look", "gx", "gy", "th",
  "f0x", "f0y", "f1x", "f1y", "spread", "yaw", "jump",
  "brow", "mouth", "squint", "shake",
] as const;
export type Pose = Record<(typeof KEYS)[number], number>;

const P = (o: Partial<Pose>): Pose => ({
  x: 0, y: -0.03, lean: 0.08, bend: 0.05, twist: 0, look: -0.1,
  gx: 0.34, gy: 1.12, th: 1.62,
  f0x: 0.24, f0y: 0, f1x: -0.2, f1y: 0, spread: 1, yaw: 0, jump: 0,
  brow: 0, mouth: 0, squint: 0, shake: 0,
  ...o,
});

const mix = (a: Pose, b: Pose, t: number, out: Pose = { ...a }) => {
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};

export const READY = P({});
const WINDUP = P({ y: -0.08, lean: -0.18, bend: -0.22, twist: -0.1, look: -0.05, gx: -0.08, gy: 1.98, th: 3.45, f0x: 0.3, f1x: -0.26, spread: 1.15, brow: -0.7, mouth: 0.15, squint: 0.4 });
const OVER = P({ y: -0.24, lean: -0.3, bend: -0.32, twist: -0.15, look: 0, gx: -0.2, gy: 1.92, th: 3.9, f0x: 0.44, f1x: -0.38, spread: 1.4, brow: -1, mouth: 0.75, squint: 0.85, shake: 1 });
const HOVER = P({ x: 0.15, jump: 0.75, y: -0.04, lean: -0.36, bend: -0.36, look: -0.25, gx: -0.25, gy: 1.98, th: 4.2, f0x: 0.14, f0y: 0.18, f1x: -0.22, f1y: 0.3, brow: -1, mouth: 1, squint: 0.6 });
const DRUM = P({ y: -0.1, lean: 0.16, bend: 0.02, look: -0.25, gx: 0.22, gy: 1.68, th: 2.35, f0x: 0.34, f1x: -0.28, spread: 1.15, brow: -0.6, mouth: 0.3, squint: 0.3 });

export type SwingKind = "normal" | "over" | "finisher" | "tap" | "miss" | "spin";
type State = "idle" | "charge" | "drum" | "swing" | "victory" | "fail" | "hover";

export interface ChargeOpts {
  over?: boolean;
  finisher?: boolean;
  /** Raise the hammer fast, for rebound stages. */
  quick?: boolean;
}

const Y = new THREE.Vector3(0, 1, 0);
const tv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

/** Two-bone IK: places A→B→C so C lands on `target`, bending toward `pole`. */
function solve(l: Limb, a: THREE.Vector3, target: THREE.Vector3, la: number, lb: number, pole: THREE.Vector3) {
  const d = tv[0].subVectors(target, a);
  const dist = clamp(d.length(), 0.05, (la + lb) * 0.999);
  d.normalize();
  const c = target.clone().copy(a).addScaledVector(d, dist);
  const cosA = clamp((la * la + dist * dist - lb * lb) / (2 * la * dist), -1, 1);
  const perp = tv[1].copy(pole).addScaledVector(d, -pole.dot(d));
  if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1);
  perp.normalize();
  const e = tv[2].copy(a).addScaledVector(d, la * cosA).addScaledVector(perp, la * Math.sqrt(1 - cosA * cosA));
  l.a.position.copy(a);
  l.a.quaternion.setFromUnitVectors(Y, tv[3].subVectors(e, a).normalize());
  l.b.position.copy(e);
  l.b.quaternion.setFromUnitVectors(Y, tv[3].subVectors(c, e).normalize());
  l.joint.position.copy(e);
  l.end.position.copy(c);
  return c;
}

export class Hero {
  readonly obj = new THREE.Group();
  readonly m: HeroModel;
  readonly hammer: HammerModel;
  private pose: Pose = { ...READY };
  private from: Pose = { ...READY };
  private state: State = "idle";
  private after: State = "idle";
  private afterOpts: ChargeOpts = {};
  private t = 0;
  private st = 0;
  private charge = 0;
  private opts: ChargeOpts = {};
  tension = 0;
  private kind: SwingKind = "normal";
  private contactAt = 0.05;
  private onContact: (() => void) | null = null;
  private hold = 0.06;
  private L = 1.2;
  private thC = -0.4;
  private gC = new THREE.Vector2(0.62, 1.02);
  private tailV = 0;
  private tailA = 0;
  private lastHeadY = 0;
  private blink = 3;
  private contacted = false;
  private rec = 0.38;
  readonly trail: Trail;

  constructor() {
    this.m = buildHero();
    this.hammer = buildHammer();
    this.obj.add(this.m.root);
    this.m.root.add(this.hammer.root);
    this.trail = new Trail();
    this.aimAt(new THREE.Vector2(1.62, 0.55));
  }

  /**
   * Fits the hammer so its striking face lands on `face` (hero frame) at
   * contact. Length and contact angle depend on each other through the head
   * offset, so a few fixed-point steps settle them.
   */
  aimAt(face: THREE.Vector2) {
    const s = face.clone().add(new THREE.Vector2(0, 0.33));
    for (let i = 0; i < 6; i++) {
      const d = s.clone().sub(this.gC);
      this.L = clamp(d.length(), 0.9, 2.8);
      this.thC = Math.atan2(d.y, d.x);
      const off = 0.33 * (0.9 + 0.25 * Math.max(0, this.L - 1.4));
      s.set(face.x - off * Math.sin(this.thC), face.y + off * Math.cos(this.thC));
    }
    this.hammer.setLength(this.L);
  }

  get length() {
    return this.L;
  }

  private contactPose(miss: boolean): Pose {
    const base = P({ y: -0.17, lean: 0.5, bend: 0.25, twist: 0.08, look: -0.35, gx: this.gC.x, gy: this.gC.y, th: this.thC, f0x: 0.42, f1x: -0.3, spread: 1.2, brow: -0.8, mouth: 1, squint: 0.9 });
    if (!miss) return base;
    // Short and low: the head buries itself in the ground in front of the target.
    const gy = 0.92;
    return { ...base, gx: 0.48, gy, th: Math.asin(clamp((0.12 - gy) / this.L, -1, 1)), lean: 0.72, f0x: 0.52, y: -0.24, brow: 0.6, mouth: 0.6 };
  }

  private failPose(): Pose {
    const gy = 0.88;
    return P({ y: -0.13, lean: 0.55, bend: 0.38, look: -0.55, gx: 0.48, gy, th: Math.asin(clamp((0.3 - gy) / this.L, -1, 1)), f0x: 0.26, f1x: -0.2, brow: 1, mouth: -1, squint: 0 });
  }

  private go(s: State, o: ChargeOpts = {}) {
    if (this.state === "swing") {
      this.after = s;
      this.afterOpts = o;
      return;
    }
    if (s !== this.state) this.st = 0;
    this.state = s;
    this.opts = o;
  }

  idle() {
    this.charge = 0;
    this.go("idle");
  }

  /** Wind up and hold while a QTE runs; tension pushes the pose further. */
  windup(o: ChargeOpts = {}) {
    this.go(o.finisher ? "hover" : "charge", o);
  }

  /** Pounding stance for rhythm stages: each tap is a short chop from here. */
  drum() {
    this.go("drum");
  }

  victory() {
    this.go("victory");
  }

  fail() {
    this.go("fail");
  }

  /** Puts the hero back on his marks, e.g. on retry. */
  reset() {
    this.state = "idle";
    this.after = "idle";
    this.st = 0;
    this.charge = 0;
    this.tension = 0;
    this.pose = { ...READY };
    this.onContact = null;
    this.trail.clear();
  }

  /**
   * Releases a swing that connects `contactIn` anim-seconds from now. The
   * swing starts from whatever pose is current, so it can interrupt a recoil
   * or a wind-up alike. `onContact` fires exactly once.
   */
  swing(kind: SwingKind, contactIn: number, onContact: () => void, hold = 0.06) {
    if (this.state !== "swing") {
      this.after = this.state === "drum" ? "drum" : this.state === "hover" || this.state === "charge" ? "idle" : this.state;
      this.afterOpts = {};
    }
    if (this.state === "swing" && !this.contacted) this.onContact?.();
    this.state = "swing";
    this.kind = kind;
    this.st = 0;
    this.from = { ...this.pose };
    this.contactAt = contactIn;
    this.onContact = onContact;
    this.contacted = false;
    this.hold = hold;
    this.rec = kind === "tap" ? 0.16 : kind === "miss" ? 0.55 : kind === "finisher" || kind === "spin" ? 0.6 : 0.38;
    if (kind === "miss") this.after = "fail";
  }

  get swinging() {
    return this.state === "swing";
  }

  /** Hammer head position in world space. */
  headWorld(out = new THREE.Vector3()) {
    return this.hammer.head.getWorldPosition(out);
  }

  private target(dt: number): { pose: Pose; rate: number } {
    const t = this.t;
    const st = this.st;
    switch (this.state) {
      case "idle": {
        const p = { ...READY };
        p.y += 0.012 * Math.sin(t * 2.2);
        p.th += 0.03 * Math.sin(t * 1.1);
        p.look += 0.06 * Math.sin(t * 0.7);
        return { pose: p, rate: 4 };
      }
      case "charge": {
        this.charge = damp(this.charge, Math.min(1, 0.78 + 0.22 * this.tension), this.opts.quick ? 18 : 5, dt);
        const p = mix(READY, this.opts.over ? OVER : WINDUP, this.charge);
        p.shake = this.tension * this.tension * (this.opts.over ? 1 : 0.35) + (this.opts.over ? 0.25 : 0);
        p.th += 0.12 * this.tension;
        return { pose: p, rate: this.opts.quick ? 16 : 6 };
      }
      case "hover": {
        this.charge = damp(this.charge, 1, 6, dt);
        const p = mix(READY, HOVER, this.charge);
        p.jump += 0.05 * Math.sin(t * 3);
        p.shake = 0.4 + 0.6 * this.tension;
        p.th += 0.15 * this.tension;
        return { pose: p, rate: 5 };
      }
      case "drum": {
        const p = { ...DRUM };
        p.th += 0.35 * this.tension;
        p.gy += 0.08 * this.tension;
        p.shake = 0.2 * this.tension;
        return { pose: p, rate: 12 };
      }
      case "victory": {
        const hop = st < 1.6 ? Math.abs(Math.sin(st * 6)) * (1 - st / 1.6) : 0;
        const p = P({ y: -0.02 + 0.03 * Math.sin(t * 2), lean: -0.1, bend: -0.12, look: 0.3, gx: 0.06, gy: 2.15 + 0.05 * Math.sin(t * 4), th: 1.57, f0x: 0.2, f1x: -0.2, brow: 0.5, mouth: 1, squint: 0.75, jump: 0.22 * hop });
        return { pose: p, rate: 7 };
      }
      case "fail": {
        const p = this.failPose();
        p.y += 0.01 * Math.sin(t * 1.4);
        return { pose: p, rate: 3 };
      }
      case "swing":
        return { pose: this.swingPose(), rate: Infinity };
    }
  }

  private swingPose(): Pose {
    const st = this.st;
    const c = this.contactPose(this.kind === "miss");
    const from = this.from;
    if (st < this.contactAt) {
      const k = st / this.contactAt;
      if (this.kind === "spin") {
        // Leaping spin: a full turn in the air, then the hammer comes down with the landing.
        const p = mix(from, c, smooth(k));
        p.yaw = -Math.PI * 2 * smooth(k);
        p.jump = Math.sin(Math.PI * Math.min(1, k * 1.05)) * 0.9;
        p.th = lerp(from.th + 0.8, c.th, easeIn(k, 2.6));
        p.mouth = 1;
        return p;
      }
      // Kinetic chain: legs and hips lead, the torso follows, the hammer whips last.
      const p = mix(from, c, easeOut(k, 3));
      for (const key of ["lean", "bend", "twist", "look"] as const) p[key] = lerp(from[key], c[key], smooth(k));
      const arm = easeIn(k, 2.2);
      p.th = lerp(from.th, c.th, arm);
      p.gx = lerp(from.gx, c.gx, Math.sqrt(arm));
      p.gy = lerp(from.gy, c.gy, arm);
      p.jump = from.jump * (1 - easeIn(k, 2));
      p.shake = 0;
      return p;
    }
    const after = st - this.contactAt;
    if (after < this.hold) {
      // Impact: the body keeps sinking for a moment while the hammer is stopped.
      const k = after / Math.max(1e-3, this.hold);
      return { ...c, y: c.y - 0.04 * easeOut(k), lean: c.lean + 0.05 * easeOut(k), shake: 0 };
    }
    const k = clamp((after - this.hold) / this.rec);
    const amp = this.kind === "tap" ? 0.35 : this.kind === "miss" ? 0.05 : 0.7;
    const bounce = Math.sin(Math.PI * Math.min(1, k * 1.3)) * amp * (1 - 0.4 * k);
    const p = { ...c };
    p.th = c.th + bounce;
    p.gy = c.gy + bounce * 0.18;
    p.y = lerp(c.y - 0.04, c.y * 0.6, smooth(k));
    // Half step back absorbing the rebound.
    p.x = -0.1 * Math.sin(Math.PI * smooth(k)) * (this.kind === "tap" ? 0.3 : 1);
    p.f0x = c.f0x - 0.06 * smooth(k);
    p.lean = lerp(c.lean, c.lean * 0.6, smooth(k));
    return p;
  }

  update(dt: number) {
    this.t += dt;
    this.st += dt;
    if (this.state === "swing") {
      if (!this.contacted && this.st >= this.contactAt) {
        this.contacted = true;
        const cb = this.onContact;
        this.onContact = null;
        cb?.();
      }
      if (this.state === "swing" && this.st >= this.contactAt + this.hold + this.rec) {
        this.state = this.after;
        this.opts = this.afterOpts;
        this.st = 0;
        if (this.state === "charge" || this.state === "hover") this.charge = 0.55;
      }
    }
    const { pose, rate } = this.target(dt);
    if (this.state === "charge" && this.st < 0.2 && this.charge < 0.6) {
      // Anticipation: a small dip before the hammer goes up.
      const a = Math.sin((this.st / 0.2) * Math.PI);
      pose.y -= 0.05 * a;
      pose.th -= 0.25 * a;
    }
    if (rate === Infinity) this.pose = pose;
    else mix(this.pose, pose, 1 - Math.exp(-rate * dt), this.pose);
    this.apply(dt);
    this.trail.update(dt, this.hammer.head, this.state === "swing" && this.st < this.contactAt + 0.04);
  }

  private apply(dt: number) {
    const p = this.pose;
    const m = this.m;
    const shake = p.shake * 0.012;
    const n = this.t * 40;
    m.root.position.set(p.x, p.jump, 0);
    m.root.rotation.y = p.yaw;
    m.pelvis.position.set(noise3(n, 1, 0) * shake, DIM.hipY + p.y + noise3(n, 2, 0) * shake, 0);
    m.pelvis.rotation.set(0, p.twist * 0.4, -p.lean * 0.35);
    m.spine.rotation.set(0, p.twist * 0.6, -p.lean * 0.65);
    m.chest.rotation.set(noise3(n, 3, 0) * shake * 2, 0, -p.bend);
    m.chest.scale.setScalar(1 + 0.015 * Math.sin(this.t * 2.2));
    // The neck counters the torso so the eyes stay on the target.
    m.neck.rotation.set(0, -p.twist * 0.6, p.look + p.lean * 0.85 + p.bend * 0.8);

    const ham = this.hammer.root;
    ham.position.set(p.gx, p.gy + p.y * 0.85, 0);
    ham.rotation.set(0, 0, p.th);
    m.root.updateMatrixWorld(true);

    const toLocal = (o: THREE.Object3D, out: THREE.Vector3) => m.root.worldToLocal(o.getWorldPosition(out));
    const dir = new THREE.Vector3(Math.cos(p.th), Math.sin(p.th), 0);
    const grip = ham.position;
    for (const i of [0, 1] as const) {
      const side = i === 0 ? -1 : 1;
      const sh = toLocal(m.shoulders[i], new THREE.Vector3());
      const hand = grip.clone().addScaledVector(dir, i === 0 ? -0.02 : 0.2);
      hand.z = side * 0.07;
      const pole = new THREE.Vector3(-0.4, -0.9, side * 1.1);
      const c = solve(m.arms[i], sh, hand, DIM.upperArm, DIM.foreArm, pole);
      m.arms[i].end.position.copy(c);
      m.arms[i].end.quaternion.copy(m.arms[i].b.quaternion);
    }
    for (const i of [0, 1] as const) {
      const side = i === 0 ? -1 : 1;
      const hip = toLocal(m.hips[i], new THREE.Vector3());
      const fx = i === 0 ? p.f0x : p.f1x;
      const fy = i === 0 ? p.f0y : p.f1y;
      const foot = new THREE.Vector3(fx - p.x * 0, DIM.ankle + fy, side * DIM.hipW * p.spread * 1.15);
      const pole = new THREE.Vector3(1, 0.1, side * 0.35);
      solve(m.legs[i], hip, foot, DIM.thigh, DIM.shin, pole);
      m.legs[i].end.rotation.set(0, 0, fy > 0.05 ? -0.4 * fy : 0);
    }

    const f = m.face;
    this.blink -= dt;
    const blink = this.blink < 0.12 ? 0.1 : 1;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      f.eyes[i].scale.y = Math.max(0.08, (1 - 0.65 * p.squint) * blink);
      f.brows[i].rotation.x = side * p.brow * 0.45;
      f.brows[i].position.y = 0.13 + 0.025 * p.brow - 0.02 * p.squint;
    }
    const open = Math.max(0, p.mouth);
    f.mouth.scale.set(0.4 + 0.15 * open, 0.12 + 0.75 * open, 1.1 - 0.15 * open + 0.2 * Math.max(0, -p.mouth));
    f.mouth.position.y = -0.165 - 0.02 * open;
    f.sweat.visible = p.shake > 0.5 || this.state === "fail";
    if (f.sweat.visible) f.sweat.position.y = 0.22 - ((this.t * 0.3) % 0.25);

    // Headband tails lag behind head motion, then settle like cloth.
    const hy = m.head.getWorldPosition(new THREE.Vector3()).y;
    const vy = (hy - this.lastHeadY) / Math.max(dt, 1e-3);
    this.lastHeadY = hy;
    this.tailV += (-this.tailA * 60 - this.tailV * 7 - clamp(vy, -20, 20) * 1.2 + Math.sin(this.t * 5) * 2) * dt;
    this.tailA = clamp(this.tailA + this.tailV * dt, -1.2, 1.2);
    f.tails.forEach((tl, i) => {
      tl.rotation.z = this.tailA * (i ? 1 : 0.8) - 0.5;
      tl.rotation.y = i ? 0.25 : -0.25;
    });
    this.hammer.core.emissiveIntensity = 0.2 + 2.5 * this.tension * this.tension + (this.state === "hover" ? 1.5 : 0);
  }
}
