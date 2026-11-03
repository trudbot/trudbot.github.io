/*
 * Pooled destruction effects: instanced debris, point particles, shockwave
 * rings, flashes and ground crack decals. Pools are fixed-size so a long
 * session never allocates during a hit; the oldest slot is recycled first.
 */
import * as THREE from "three";
import { toon } from "./materials.ts";
import { clamp, crackTex, easeOut, glow, rng } from "./util.ts";

const PT_VS = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.05, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const PT_FS = /* glsl */ `
uniform sampler2D uMap;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export interface PtOpts {
  color: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  size: number;
  /** Size multiplier reached at the end of life. */
  grow?: number;
  speed: number;
  life: number;
  gravity?: number;
  drag?: number;
  /** Bias added to every velocity, e.g. upward for rising dust. */
  bias?: THREE.Vector3;
  /** Emission volume radius. */
  radius?: number;
  /** Restricts directions to a cone around this axis. */
  dir?: THREE.Vector3;
  cone?: number;
  alpha?: number;
  ground?: number;
}

const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();
const r = rng(97);

function randDir(out: THREE.Vector3, dir?: THREE.Vector3, cone = Math.PI) {
  for (;;) {
    out.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
    const l = out.lengthSq();
    if (l > 1e-3 && l <= 1) break;
  }
  out.normalize();
  if (dir && cone < Math.PI) {
    // Blend toward the axis: cheap and good enough for a visual cone.
    const k = cone / Math.PI;
    out.multiplyScalar(k).addScaledVector(dir, 1 - k).normalize();
  }
  return out;
}

class Points {
  readonly obj: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private meta: Float32Array; // life, maxLife, size0, grow, gravity, drag, alpha0, ground
  private next = 0;
  readonly mat: THREE.ShaderMaterial;

  constructor(n: number, additive: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.meta = new Float32Array(n * 8);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glow() }, uScale: { value: 500 } },
      vertexShader: PT_VS,
      fragmentShader: PT_FS,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.obj = new THREE.Points(g, this.mat);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = additive ? 3 : 2;
  }

  emit(at: THREE.Vector3, count: number, o: PtOpts) {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      randDir(tmpV, o.dir, o.cone);
      const rad = (o.radius ?? 0) * r();
      this.pos[i * 3] = at.x + tmpV.x * rad;
      this.pos[i * 3 + 1] = at.y + tmpV.y * rad;
      this.pos[i * 3 + 2] = at.z + tmpV.z * rad;
      const sp = o.speed * (0.35 + 0.65 * r());
      this.vel[i * 3] = tmpV.x * sp + (o.bias?.x ?? 0);
      this.vel[i * 3 + 1] = tmpV.y * sp + (o.bias?.y ?? 0);
      this.vel[i * 3 + 2] = tmpV.z * sp + (o.bias?.z ?? 0);
      tmpC.set(colors[Math.floor(r() * colors.length)]);
      this.col.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
      const life = o.life * (0.6 + 0.4 * r());
      this.meta.set([life, life, o.size * (0.6 + 0.6 * r()), o.grow ?? 1, o.gravity ?? 0, o.drag ?? 1, o.alpha ?? 1, o.ground ?? -1e9], i * 8);
    }
  }

  update(dt: number) {
    const m = this.meta;
    for (let i = 0; i < this.n; i++) {
      const b = i * 8;
      if (m[b] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      m[b] -= dt;
      const t = 1 - clamp(m[b] / m[b + 1]);
      const drag = Math.exp(-m[b + 5] * dt);
      const v = i * 3;
      this.vel[v] *= drag;
      this.vel[v + 1] = this.vel[v + 1] * drag - m[b + 4] * dt;
      this.vel[v + 2] *= drag;
      this.pos[v] += this.vel[v] * dt;
      this.pos[v + 1] += this.vel[v + 1] * dt;
      this.pos[v + 2] += this.vel[v + 2] * dt;
      if (this.pos[v + 1] < m[b + 7]) {
        this.pos[v + 1] = m[b + 7];
        this.vel[v + 1] *= -0.3;
      }
      this.size[i] = m[b + 2] * (1 + (m[b + 3] - 1) * easeOut(t, 2));
      // Quick fade-in avoids popping; long fade-out lets clouds linger.
      this.alpha[i] = m[b + 6] * Math.min(1, t * 12) * (1 - t) * (1 - t * 0.3);
    }
    const g = this.obj.geometry;
    for (const a of ["position", "aSize", "aAlpha", "aColor"]) g.attributes[a].needsUpdate = true;
  }

  clear() {
    this.meta.fill(0);
    this.alpha.fill(0);
  }
}

export type DebrisKind = "chunk" | "shard" | "glint";

export interface DebrisOpts {
  color: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  size: number;
  speed: number;
  life?: number;
  gravity?: number;
  dir?: THREE.Vector3;
  cone?: number;
  radius?: number;
  ground?: number;
  spin?: number;
}

function rockGeo() {
  const g = new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed();
  const p = g.attributes.position as THREE.BufferAttribute;
  const jr = rng(5);
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    // Same jitter for shared corners, so the hull stays closed.
    if (!seen.has(k)) seen.set(k, 0.65 + jr() * 0.6);
    const s = seen.get(k)!;
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.8, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

function shardGeo() {
  const g = new THREE.BufferGeometry();
  // A thin, uneven wedge: reads as a sliver of ceramic or ice from every angle.
  const v = [0, 0.6, 0, -0.35, -0.3, 0.06, 0.4, -0.25, 0.06, 0, -0.1, -0.08];
  const idx = [0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2];
  const pos: number[] = [];
  for (const i of idx) pos.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

class Debris {
  readonly mesh: THREE.InstancedMesh;
  private n: number;
  private next = 0;
  private s: { p: THREE.Vector3; v: THREE.Vector3; q: THREE.Quaternion; w: THREE.Vector3; size: number; life: number; max: number; g: number; ground: number }[] = [];
  private m = new THREE.Matrix4();
  private dq = new THREE.Quaternion();
  private sc = new THREE.Vector3();

  constructor(kind: DebrisKind, n: number) {
    this.n = n;
    const geo = kind === "chunk" ? rockGeo() : shardGeo();
    const mat =
      kind === "glint"
        ? new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        : toon({ color: 0xffffff, rim: 0.35, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = kind === "chunk";
    this.mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      this.s.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), size: 0, life: 0, max: 1, g: 0, ground: -1e9 });
      this.mesh.setColorAt(i, tmpC.set(0xffffff));
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    }
  }

  emit(at: THREE.Vector3, count: number, o: DebrisOpts) {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const d = this.s[i];
      randDir(tmpV, o.dir, o.cone);
      d.p.copy(at).addScaledVector(tmpV, (o.radius ?? 0) * r());
      d.v.copy(tmpV).multiplyScalar(o.speed * (0.4 + 0.6 * r()));
      d.q.setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
      d.w.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar((o.spin ?? 14) * 2);
      d.size = o.size * (0.35 + r() * 0.9);
      d.max = d.life = (o.life ?? 2.2) * (0.7 + 0.5 * r());
      d.g = o.gravity ?? 9.8;
      d.ground = o.ground ?? -1e9;
      this.mesh.setColorAt(i, tmpC.set(colors[Math.floor(r() * colors.length)]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      const d = this.s[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= d.g * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < d.ground + d.size * 0.3) {
        d.p.y = d.ground + d.size * 0.3;
        // Heavy pieces barely bounce; friction kills slide and spin quickly.
        d.v.y = Math.abs(d.v.y) * 0.25;
        d.v.x *= 0.6;
        d.v.z *= 0.6;
        d.w.multiplyScalar(0.6);
      }
      const wl = d.w.length();
      if (wl > 1e-4) {
        this.dq.setFromAxisAngle(tmpV.copy(d.w).divideScalar(wl), wl * dt);
        d.q.premultiply(this.dq);
      }
      const fade = d.life <= 0 ? 0 : Math.min(1, d.life / (d.max * 0.25));
      this.sc.setScalar(d.size * fade);
      this.m.compose(d.p, d.q, this.sc);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.n; i++) {
      this.s[i].life = 0;
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Timed {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  step: (k: number, o: THREE.Object3D) => void;
}

export interface Body {
  obj: THREE.Object3D;
  v: THREE.Vector3;
  w: THREE.Vector3;
  g: number;
  drag: number;
  ground?: number;
  /** Seconds before the piece starts moving, for staggered collapses. */
  delay?: number;
}

// Ring geometry spans radius 0.7…1; the band is brightest at its middle.
const RING_VS = /* glsl */ `
varying float vR;
void main() { vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vR;
void main() {
  float d = abs((vR - 0.7) / 0.3 - 0.6) / 0.6;
  gl_FragColor = vec4(uColor, uAlpha * max(0.0, 1.0 - d * d));
}
`;

export class Fx {
  readonly root = new THREE.Group();
  readonly dust = new Points(900, false);
  readonly sparks = new Points(700, true);
  private debris: Record<DebrisKind, Debris> = {
    chunk: new Debris("chunk", 160),
    shard: new Debris("shard", 220),
    glint: new Debris("glint", 160),
  };
  private timed: Timed[] = [];
  private bodies: Body[] = [];
  private ringGeo = new THREE.RingGeometry(0.7, 1, 72, 1);
  private flashMat = new THREE.SpriteMaterial({ map: glow(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  private decals: THREE.Mesh[] = [];

  constructor() {
    this.root.add(this.dust.obj, this.sparks.obj);
    for (const d of Object.values(this.debris)) this.root.add(d.mesh);
  }

  /** Point sprites scale with the viewport so particles look the same on any screen. */
  setViewport(h: number, fov: number) {
    const s = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
    this.dust.mat.uniforms.uScale.value = s;
    this.sparks.mat.uniforms.uScale.value = s;
  }

  puff(at: THREE.Vector3, count: number, o: PtOpts) {
    this.dust.emit(at, count, o);
  }

  spark(at: THREE.Vector3, count: number, o: PtOpts) {
    this.sparks.emit(at, count, o);
  }

  burst(kind: DebrisKind, at: THREE.Vector3, count: number, o: DebrisOpts) {
    this.debris[kind].emit(at, count, o);
  }

  /** Expanding shockwave; `normal` is the plane it travels in. */
  ring(at: THREE.Vector3, normal: THREE.Vector3, radius: number, color: THREE.ColorRepresentation, dur = 0.6, alpha = 0.9) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha } },
      vertexShader: RING_VS,
      fragmentShader: RING_FS,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.copy(at);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
    m.renderOrder = 4;
    this.tween(m, dur, (k) => {
      m.scale.setScalar(0.05 + radius * easeOut(k, 3));
      mat.uniforms.uAlpha.value = alpha * (1 - k) * (1 - k);
    });
  }

  flash(at: THREE.Vector3, color: THREE.ColorRepresentation, size: number, dur = 0.25) {
    const m = this.flashMat.clone();
    m.color.set(color);
    const s = new THREE.Sprite(m);
    s.position.copy(at);
    s.renderOrder = 5;
    this.tween(s, dur, (k) => {
      s.scale.setScalar(size * (0.6 + 0.8 * easeOut(k, 2)));
      m.opacity = (1 - k) * (1 - k);
    });
  }

  /** Ground crack decal that stays until the scene resets. */
  decal(at: THREE.Vector3, size: number, seed: number, color?: string, normal = new THREE.Vector3(0, 1, 0)) {
    const mat = new THREE.MeshBasicMaterial({ map: crackTex(seed, color), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.position.copy(at).addScaledVector(normal, 0.01);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    m.rotateZ(seed);
    m.renderOrder = 1;
    this.root.add(m);
    this.decals.push(m);
    m.scale.setScalar(0.001);
    this.timed.push({ obj: m, t: 0, dur: 0.25, step: (k) => m.scale.setScalar(Math.max(0.001, size * easeOut(k, 2))) });
    return m;
  }

  /** Runs `step(k)` with k from 0 to 1 over `dur`, then removes the object. */
  tween(obj: THREE.Object3D, dur: number, step: (k: number, o: THREE.Object3D) => void) {
    this.root.add(obj);
    step(0, obj);
    this.timed.push({ obj, t: 0, dur, step });
  }

  /** Ballistic motion for fractured pieces owned by a scene. */
  throw(b: Body) {
    this.bodies.push(b);
  }

  update(dt: number) {
    this.dust.update(dt);
    this.sparks.update(dt);
    for (const d of Object.values(this.debris)) d.update(dt);
    this.timed = this.timed.filter((t) => {
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      t.step(k, t.obj);
      if (k < 1) return true;
      if (!this.decals.includes(t.obj as THREE.Mesh)) this.dispose(t.obj);
      return false;
    });
    for (const b of this.bodies) {
      if (b.delay && b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      const drag = Math.exp(-b.drag * dt);
      b.v.multiplyScalar(drag);
      b.v.y -= b.g * dt;
      b.obj.position.addScaledVector(b.v, dt);
      if (b.ground !== undefined && b.obj.position.y < b.ground) {
        b.obj.position.y = b.ground;
        b.v.y = Math.abs(b.v.y) * 0.2;
        b.v.x *= 0.5;
        b.v.z *= 0.5;
        b.w.multiplyScalar(0.5);
      }
      b.obj.rotation.x += b.w.x * dt;
      b.obj.rotation.y += b.w.y * dt;
      b.obj.rotation.z += b.w.z * dt;
    }
  }

  private dispose(o: THREE.Object3D) {
    o.removeFromParent();
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && m !== this.flashMat) {
      (m as THREE.MeshBasicMaterial).map?.dispose?.();
      m.dispose();
    }
  }

  /** Drops every live effect, e.g. on retry. */
  clear() {
    this.dust.clear();
    this.sparks.clear();
    for (const d of Object.values(this.debris)) d.clear();
    for (const t of this.timed) if (!this.decals.includes(t.obj as THREE.Mesh)) this.dispose(t.obj);
    for (const d of this.decals) {
      d.geometry.dispose();
      this.dispose(d);
    }
    this.timed = [];
    this.decals = [];
    this.bodies = [];
  }
}
