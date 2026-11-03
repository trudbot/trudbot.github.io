/*
 * Building blocks shared by every world: sky dome, star field, lights,
 * breakable props and the World contract the director drives.
 */
import * as THREE from "three";
import type { Grade, SceneId } from "../game/config.ts";
import type { Material } from "../audio/sfx.ts";
import type { Hero } from "../hero/rig.ts";
import type { Shot } from "../render/camera.ts";
import type { Fx } from "../render/fx.ts";
import { toon, withInner, type Look, type ToonMat } from "../render/materials.ts";
import { damp, fracture, rng, type Chunk } from "../render/util.ts";

export type ShotName = "idle" | "charge" | "over" | "final" | "impact" | "result" | "arrive" | "title";

export interface Ctx {
  fx: Fx;
  hero: Hero;
  /** Camera trauma and FOV punch, already scaled per world. */
  shake(amount: number, fov?: number): void;
  /** Composite flash, ripple and blur at a world point. */
  pulse(at: THREE.Vector3, o: { flash?: number; color?: THREE.ColorRepresentation; ripple?: number; blur?: number; aberr?: number }): void;
}

export interface Hit {
  /** Stage index within the level. */
  stage: number;
  grade: Grade;
  /** 0…1, accuracy-driven and capped by the director. */
  power: number;
}

export abstract class World {
  abstract readonly id: SceneId | "ending";
  readonly group = new THREE.Group();
  abstract readonly material: Material;
  /** 0 for the pot, 1 for the universe; scales sound, shake and hit stop. */
  abstract readonly scale: number;
  /** Where the hammer face meets the target, in the hero's frame (x toward the target, y up). */
  abstract readonly face: THREE.Vector2;
  /** Target's rough radius; sizes debris and dust. */
  abstract readonly unit: number;
  abstract readonly shots: Record<ShotName, Shot>;
  readonly heroAt = new THREE.Vector3();
  background = new THREE.Color(0x1a1a2e);
  fog: THREE.Fog | THREE.FogExp2 | null = null;
  /** Camera shake multiplier: big worlds shake slower and harder. */
  shakeScale = 1;
  /** Ground height under the hero's feet, for overcharge cracks. */
  ground = 0;
  /** Colours for overcharge pebbles and dust. */
  dustColor: THREE.ColorRepresentation = 0xd9c7a8;
  protected ctx!: Ctx;
  protected t = 0;

  init(ctx: Ctx) {
    this.ctx = ctx;
    this.build();
    this.reset();
  }

  protected abstract build(): void;
  /** Restores the intact target, e.g. on retry. */
  abstract reset(): void;
  /** Damage from a successful non-final stage. */
  abstract hit(h: Hit): void;
  /** One tap of a rhythm stage. */
  tap(h: Hit, i: number) {
    this.hit({ ...h, power: h.power * 0.4 });
    void i;
  }
  /** The final, destroying hit. */
  abstract finale(h: Hit): void;
  /** Springs the hidden stage after a fake finish; only worlds with a surprise stage use it. */
  reveal() {}
  /** The hammer hits the ground short of the target. */
  miss() {
    const p = this.impact().clone();
    p.x -= 0.6;
    p.y = this.ground;
    this.ctx.fx.puff(p, 14, { color: this.dustColor, size: 0.35, grow: 2.5, speed: 1.2, life: 1, drag: 3, bias: new THREE.Vector3(0, 0.4, 0) });
    this.ctx.shake(0.18);
  }
  private timers: { at: number; fn: () => void }[] = [];

  /** World-space contact point on the target. */
  impact(): THREE.Vector3 {
    return new THREE.Vector3(this.face.x, this.face.y, 0).add(this.heroAt);
  }

  /** Runs `fn` after `sec` seconds of world time; cleared by `clearTimers`. */
  protected after(sec: number, fn: () => void) {
    this.timers.push({ at: this.t + sec, fn });
  }

  protected clearTimers() {
    this.timers = [];
  }

  update(dt: number) {
    this.t += dt;
    if (!this.timers.length) return;
    const due = this.timers.filter((x) => x.at <= this.t);
    this.timers = this.timers.filter((x) => x.at > this.t);
    for (const x of due) x.fn();
  }
  enter() {}
  exit() {}
}

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
const SKY_FS = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBottom;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform float uSunSize;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 c = h > 0.0 ? mix(uMid, uTop, pow(h, 0.6)) : mix(uMid, uBottom, pow(-h, 0.5));
  float s = max(0.0, dot(vDir, normalize(uSunDir)));
  c += uSun * (pow(s, 600.0 / uSunSize) * 2.5 + pow(s, 12.0) * 0.35);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function sky(o: { top: number; mid: number; bottom: number; sun?: number; sunDir?: THREE.Vector3; sunSize?: number }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(o.top) },
      uMid: { value: new THREE.Color(o.mid) },
      uBottom: { value: new THREE.Color(o.bottom) },
      uSun: { value: new THREE.Color(o.sun ?? 0x000000) },
      uSunDir: { value: o.sunDir ?? new THREE.Vector3(1, 0.3, -0.5) },
      uSunSize: { value: o.sunSize ?? 1 },
    },
    vertexShader: SKY_VS,
    fragmentShader: SKY_FS,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

export function stars(n: number, radius: number, seed: number, size = 2.2, colors = [0xffffff, 0xb5f5ec, 0xffc4d6, 0xffeaa7]) {
  const r = rng(seed);
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.push(Math.cos(a) * s * radius, u * radius, Math.sin(a) * s * radius);
    c.set(colors[Math.floor(r() * colors.length)]).multiplyScalar(0.5 + r() * 0.8);
    col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.renderOrder = -9;
  return p;
}

export function lights(
  parent: THREE.Object3D,
  o: { sky: number; ground: number; hemi: number; key: number; keyI: number; dir: [number, number, number]; rim?: number; rimI?: number; shadow?: number; center?: THREE.Vector3 },
) {
  const hemi = new THREE.HemisphereLight(o.sky, o.ground, o.hemi);
  const key = new THREE.DirectionalLight(o.key, o.keyI);
  const c = o.center ?? new THREE.Vector3(1, 0, 0);
  key.position.set(c.x + o.dir[0], c.y + o.dir[1], c.z + o.dir[2]);
  key.target.position.copy(c);
  key.castShadow = true;
  const s = o.shadow ?? 5;
  Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 80 });
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  parent.add(hemi, key, key.target);
  let rim: THREE.DirectionalLight | null = null;
  if (o.rim !== undefined) {
    // Back light from the far side carves the hero and target out of the background.
    rim = new THREE.DirectionalLight(o.rim, o.rimI ?? 1);
    rim.position.set(c.x - o.dir[0] * 0.6, c.y + o.dir[1] * 0.5, c.z - o.dir[2] - 6);
    rim.target.position.copy(c);
    parent.add(rim, rim.target);
  }
  return { hemi, key, rim };
}

export function disc(radius: number, look: Look, seg = 64) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, seg).rotateX(-Math.PI / 2), toon(look));
  m.receiveShadow = true;
  return m;
}

export interface BreakOpts {
  speed: number;
  up?: number;
  spin?: number;
  gravity?: number;
  drag?: number;
  /** Ground height in the breakable's local frame. */
  ground?: number;
  /** Seconds of delay per unit distance from the origin: the break propagates. */
  stagger?: number;
  /** Pieces nearer than this to the origin fly; the rest only slump. */
  reach?: number;
}

/**
 * A prop that cracks, dents and finally flies apart into pre-fractured
 * chunks. The object is never rotated or scaled, so throw velocities stay in
 * world units.
 */
export class Breakable {
  readonly obj = new THREE.Group();
  readonly intact: THREE.Mesh;
  readonly mat: ToonMat;
  readonly chunkMat: ToonMat;
  private chunks: { mesh: THREE.Mesh; home: THREE.Vector3; c: Chunk }[] = [];
  private reach = 0;
  private reachTo = 0;
  private dent = 0;
  private dentTo = 0;
  broken = false;

  constructor(geo: THREE.BufferGeometry, look: Look, pieces: number, seed: number, core = new THREE.Vector3(), depth = 0.6) {
    this.mat = toon(look);
    this.intact = new THREE.Mesh(look.interior ? withInner(geo) : geo, this.mat);
    this.intact.castShadow = this.intact.receiveShadow = true;
    this.obj.add(this.intact);
    this.chunkMat = toon({ ...look, crack: look.crack ?? 0x000000, interior: look.interior ?? look.color, side: THREE.DoubleSide });
    for (const c of fracture(geo, pieces, rng(seed), core, depth)) {
      const mesh = new THREE.Mesh(c.geo, this.chunkMat);
      mesh.castShadow = true;
      mesh.visible = false;
      this.obj.add(mesh);
      this.chunks.push({ mesh, home: c.center.clone(), c });
    }
  }

  get pieces() {
    return this.chunks.map((c) => c.mesh);
  }

  /** Spreads glowing cracks from a local point; `reach` is in object units. */
  crack(at: THREE.Vector3, reach: number, glow = 1.5) {
    const u = this.mat.fx;
    u.uCrack.value.set(at.x, at.y, at.z, this.reach);
    this.reachTo = Math.max(this.reachTo, reach);
    u.uCrackGlow.value = glow;
  }

  dentAt(at: THREE.Vector3, depth: number, radius: number) {
    this.mat.fx.uDent.value.set(at.x, at.y, at.z, this.dent);
    this.mat.fx.uDentR.value = radius;
    this.dentTo = Math.max(this.dentTo, depth);
  }

  shatter(fx: Fx, origin: THREE.Vector3, o: BreakOpts) {
    if (this.broken) return;
    this.broken = true;
    this.intact.visible = false;
    const r = rng(Math.floor(origin.x * 1000) + 3);
    const local = this.obj.worldToLocal(origin.clone());
    for (const ch of this.chunks) {
      ch.mesh.visible = true;
      const d = ch.home.clone().sub(local);
      const dist = d.length();
      const near = o.reach === undefined || dist < o.reach;
      d.normalize();
      d.y += o.up ?? 0.5;
      const k = (near ? 1 : 0.15) * (0.6 + 0.8 * r()) / Math.sqrt(Math.max(0.3, ch.c.size));
      fx.throw({
        obj: ch.mesh,
        v: d.multiplyScalar(o.speed * k),
        w: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar((o.spin ?? 6) * (near ? 1 : 0.2)),
        g: o.gravity ?? 9.8,
        drag: o.drag ?? 0.3,
        ground: o.ground,
        delay: (o.stagger ?? 0) * dist,
      });
    }
  }

  update(dt: number) {
    this.reach = damp(this.reach, this.reachTo, 6, dt);
    this.dent = damp(this.dent, this.dentTo, 18, dt);
    this.mat.fx.uCrack.value.w = this.reach;
    this.mat.fx.uDent.value.w = this.dent;
  }

  reset() {
    this.broken = false;
    this.intact.visible = true;
    this.reach = this.reachTo = this.dent = this.dentTo = 0;
    this.mat.fx.uCrack.value.w = 0;
    this.mat.fx.uDent.value.w = 0;
    for (const ch of this.chunks) {
      ch.mesh.visible = false;
      ch.mesh.position.copy(ch.home);
      ch.mesh.rotation.set(0, 0, 0);
    }
  }
}
