import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

let gradientMap: THREE.DataTexture | null = null;

/** Three-band ramp shared by every toon material, which gives the cel-shaded look. */
export function toonGradient(): THREE.DataTexture {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([150, 205, 255]);
  gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

export interface ToonOptions {
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  map?: THREE.Texture | null;
  transparent?: boolean;
  opacity?: number;
  vertexColors?: boolean;
  side?: THREE.Side;
  /** Disables the ink outline, e.g. for decals lying on another surface. */
  outline?: boolean;
  outlineThickness?: number;
  /**
   * Shared materials are cached by their options. Anything mutated at runtime
   * (night glow, flashing screens) must be unique or it would recolor every
   * other mesh using the same cached instance.
   */
  unique?: boolean;
}

const materialCache = new Map<string, THREE.MeshToonMaterial>();

export function toon(color: THREE.ColorRepresentation, opts: ToonOptions = {}) {
  const key = opts.unique || opts.map ? null : `${String(color)}|${JSON.stringify(opts)}`;
  if (key) {
    const cached = materialCache.get(key);
    if (cached) return cached;
  }

  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(),
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    vertexColors: opts.vertexColors ?? false,
    side: opts.side ?? THREE.FrontSide,
  });
  if (opts.emissive !== undefined) {
    mat.emissive.set(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  if (opts.transparent) mat.depthWrite = false;
  setOutline(mat, opts.outline ?? true, opts.outlineThickness);

  if (key) materialCache.set(key, mat);
  return mat;
}

/** Controls OutlineEffect per material (see `userData.outlineParameters` in three's OutlineEffect). */
export function setOutline(mat: THREE.Material, visible: boolean, thickness?: number) {
  mat.userData.outlineParameters = {
    visible,
    thickness: thickness ?? 0.0032,
    color: [0.11, 0.09, 0.16],
  };
}

export function basic(color: THREE.ColorRepresentation, opts: { map?: THREE.Texture; transparent?: boolean; opacity?: number } = {}) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    map: opts.map ?? null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  setOutline(mat, false);
  return mat;
}

const geometryCache = new Map<string, THREE.BufferGeometry>();

function cachedGeometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let geo = geometryCache.get(key) as T | undefined;
  if (!geo) {
    geo = make();
    geometryCache.set(key, geo);
  }
  return geo;
}

export const geo = {
  box: (w: number, h: number, d: number, r = 0.08, seg = 2) =>
    cachedGeometry(`rb${w},${h},${d},${r},${seg}`, () =>
      new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999),
    ),
  sphere: (r: number, w = 20, h = 14) =>
    cachedGeometry(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)),
  cyl: (rt: number, rb: number, h: number, seg = 20) =>
    cachedGeometry(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r: number, h: number, seg = 16) =>
    cachedGeometry(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  torus: (r: number, t: number, arc = Math.PI * 2, rs = 10, ts = 28) =>
    cachedGeometry(`t${r},${t},${arc},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  capsule: (r: number, len: number) =>
    cachedGeometry(`cap${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14)),
  plane: (w: number, h: number) =>
    cachedGeometry(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
  ico: (r: number, detail = 1) =>
    cachedGeometry(`i${r},${detail}`, () => new THREE.IcosahedronGeometry(r, detail)),
  custom: <T extends THREE.BufferGeometry>(key: string, make: () => T) => cachedGeometry(key, make),
};

export interface MeshOptions {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: number | [number, number, number];
  cast?: boolean;
  receive?: boolean;
  name?: string;
}

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, opts: MeshOptions = {}) {
  const m = new THREE.Mesh(geometry, material);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale !== undefined) {
    if (typeof opts.scale === "number") m.scale.setScalar(opts.scale);
    else m.scale.set(...opts.scale);
  }
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  if (opts.name) m.name = opts.name;
  return m;
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  if (children.length) g.add(...children);
  return g;
}

/**
 * Bakes every static mesh under `root` into one mesh per material. The outline
 * pass renders each mesh twice, so without this the town costs thousands of
 * draw calls. `root` must sit at the scene origin. Meshes flagged with
 * `userData.keep` (camera blockers, animated parts) stay untouched, and meshes
 * must not use negative scale because baking would flip their winding.
 */
export function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; parts: THREE.BufferGeometry[] }>();
  const merged: THREE.Mesh[] = [];

  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    for (let p: THREE.Object3D | null = m; p && p !== root; p = p.parent) if (p.userData.keep) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv" && name !== "color") g.deleteAttribute(name);
    }
    g.applyMatrix4(m.matrixWorld);
    const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}|${Object.keys(g.attributes).sort().join()}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: m.material, cast: m.castShadow, receive: m.receiveShadow, parts: [] };
      buckets.set(key, bucket);
    }
    bucket.parts.push(g);
    merged.push(m);
  });

  for (const m of merged) m.removeFromParent();
  for (const bucket of buckets.values()) {
    const combined = mergeGeometries(bucket.parts, false);
    for (const part of bucket.parts) part.dispose();
    if (!combined) continue;
    const out = new THREE.Mesh(combined, bucket.material);
    out.castShadow = bucket.cast;
    out.receiveShadow = bucket.receive;
    root.add(out);
  }
}

// ─── Canvas textures ────────────────────────────────────────────────────────

const UI_FONT = `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`;

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function signTexture(text: string, bg: string, fg = "#14151f", sub?: string) {
  return canvasTexture(512, 160, (ctx) => {
    roundRect(ctx, 6, 6, 500, 148, 34);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1c1729";
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${sub ? 60 : 72}px ${UI_FONT}`;
    ctx.fillText(text, 256, sub ? 66 : 82, 460);
    if (sub) {
      ctx.font = `700 30px ${UI_FONT}`;
      ctx.globalAlpha = 0.7;
      ctx.fillText(sub, 256, 122, 460);
    }
  });
}

export function stripeTexture(a: string, b: string, stripes = 8, vertical = true) {
  const tex = canvasTexture(256, 256, (ctx) => {
    const size = 256 / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? a : b;
      if (vertical) ctx.fillRect(i * size, 0, size, 256);
      else ctx.fillRect(0, i * size, 256, size);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function labelFont(size: number, weight = 800) {
  return `${weight} ${size}px ${UI_FONT}`;
}
