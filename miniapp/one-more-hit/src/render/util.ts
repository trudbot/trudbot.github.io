/* Procedural helpers: seeded randomness, noise, geometry and canvas textures. */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
export type Rng = ReturnType<typeof rng>;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t: number, p = 3) => 1 - Math.pow(1 - clamp(t), p);
export const easeIn = (t: number, p = 3) => Math.pow(clamp(t), p);
export const easeInOut = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** Overshooting ease-out for snappy settles. */
export const backOut = (t: number, s = 1.7) => {
  const x = clamp(t) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
};
/** Frame-rate independent exponential approach. */
export const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));

/** Smooth 3D value noise, roughly in [-1, 1]. */
export function noise3(x: number, y: number, z: number) {
  const h = (i: number, j: number, k: number) => {
    const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

export function fbm(x: number, y: number, z: number, oct = 4) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    a += amp * noise3(x * f, y * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return a;
}

/** Pushes vertices along their normals; vertices are welded first so seams stay closed. */
export function displace(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => number) {
  const g = mergeVertices(geo.deleteAttribute("normal").deleteAttribute("uv"), 1e-4);
  g.computeVertexNormals();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    p.addScaledVector(n, fn(p, n));
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

export interface Chunk {
  geo: THREE.BufferGeometry;
  /** Chunk centroid in the source object's space; the geometry is centred on it. */
  center: THREE.Vector3;
  /** Rough radius, used for mass and spin. */
  size: number;
}

/**
 * Splits a closed mesh into solid pieces. Each surface triangle joins the
 * nearest of `n` seeds; the piece is then thickened toward `core` and its
 * open borders are walled, so chunks read as solid when they tumble. Inner
 * and wall faces carry aInner = 1 to pick up the interior colour.
 */
export function fracture(src: THREE.BufferGeometry, n: number, r: Rng, core = new THREE.Vector3(), depth = 0.35): Chunk[] {
  const g = src.index ? src.toNonIndexed() : src.clone();
  const pos = g.attributes.position as THREE.BufferAttribute;
  // Outer faces keep the source normals so smooth surfaces stay smooth.
  const nor = g.attributes.normal as THREE.BufferAttribute | undefined;
  // UVs and colours ride along so painted surfaces (glazes, planet maps, snow) survive the break.
  const uvA = g.attributes.uv as THREE.BufferAttribute | undefined;
  const colA = g.attributes.color as THREE.BufferAttribute | undefined;
  const tris = pos.count / 3;
  const seeds: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) seeds.push(new THREE.Vector3().fromBufferAttribute(pos, Math.floor(r() * tris) * 3));
  const groups: number[][] = seeds.map(() => []);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    m.copy(a).add(b).add(c).divideScalar(3);
    let best = 0, bd = Infinity;
    for (let s = 0; s < n; s++) {
      const d = m.distanceToSquared(seeds[s]);
      if (d < bd) (bd = d), (best = s);
    }
    groups[best].push(t);
  }
  const out: Chunk[] = [];
  const key = (v: THREE.Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  for (const tl of groups) {
    if (!tl.length) continue;
    const verts: number[] = [];
    const inner: number[] = [];
    const smoothN: number[] = [];
    const uvs: number[] = [];
    const cols: number[] = [];
    const center = new THREE.Vector3();
    const P = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i);
    for (const t of tl) for (let k = 0; k < 3; k++) center.add(P(t * 3 + k));
    center.divideScalar(tl.length * 3);
    const shrink = (v: THREE.Vector3) => v.clone().lerp(core, depth);
    let uvU = 0, uvV = 0, cr = 1, cg = 1, cb = 1;
    const push = (v: THREE.Vector3, inn: number) => {
      verts.push(v.x - center.x, v.y - center.y, v.z - center.z);
      inner.push(inn);
      uvs.push(uvU, uvV);
      cols.push(cr, cg, cb);
    };
    const uvOf = (i: number) => {
      if (uvA) (uvU = uvA.getX(i)), (uvV = uvA.getY(i));
      if (colA) (cr = colA.getX(i)), (cg = colA.getY(i)), (cb = colA.getZ(i));
    };
    const edges = new Map<string, [THREE.Vector3, THREE.Vector3]>();
    for (const t of tl) {
      const v = [P(t * 3), P(t * 3 + 1), P(t * 3 + 2)];
      v.forEach((x, k) => {
        uvOf(t * 3 + k);
        push(x, 0);
      });
      if (nor) for (let k = 0; k < 3; k++) smoothN.push(nor.getX(t * 3 + k), nor.getY(t * 3 + k), nor.getZ(t * 3 + k));
      // Inner skin, wound the other way so it faces into the piece.
      push(shrink(v[0]), 1);
      push(shrink(v[2]), 1);
      push(shrink(v[1]), 1);
      for (let k = 0; k < 3; k++) {
        const p = v[k], q = v[(k + 1) % 3];
        const kf = key(p) + "|" + key(q), kr = key(q) + "|" + key(p);
        if (edges.has(kr)) edges.delete(kr);
        else edges.set(kf, [p, q]);
      }
    }
    for (const [p, q] of edges.values()) {
      const pi = shrink(p), qi = shrink(q);
      push(q, 1), push(p, 1), push(pi, 1);
      push(q, 1), push(pi, 1), push(qi, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("aInner", new THREE.Float32BufferAttribute(inner, 1));
    if (uvA) geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    if (colA) geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    if (nor) {
      // Outer and inner skins alternate in blocks of three vertices.
      const na = geo.attributes.normal as THREE.BufferAttribute;
      for (let i = 0; i < tl.length; i++)
        for (let k = 0; k < 3; k++) {
          const o = i * 3 + k;
          na.setXYZ(i * 6 + k, smoothN[o * 3], smoothN[o * 3 + 1], smoothN[o * 3 + 2]);
        }
    }
    geo.computeBoundingSphere();
    out.push({ geo, center, size: geo.boundingSphere!.radius });
  }
  g.dispose();
  return out;
}

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let glowTex: THREE.Texture | null = null;
/** Soft radial falloff for glows, dust and sparks. */
export function glow() {
  return (glowTex ??= canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }));
}

/** Radial crack pattern for ground decals. */
export function crackTex(seed: number, color = "rgba(26,26,46,0.9)") {
  const r = rng(seed);
  return canvasTex(256, 256, (c) => {
    c.strokeStyle = color;
    c.lineCap = "round";
    const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
      let px = x, py = y;
      const steps = 6;
      for (let i = 0; i < steps; i++) {
        ang += (r() - 0.5) * 0.7;
        const nx = px + Math.cos(ang) * (len / steps);
        const ny = py + Math.sin(ang) * (len / steps);
        c.lineWidth = w * (1 - (i / steps) * 0.7);
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(nx, ny);
        c.stroke();
        (px = nx), (py = ny);
        if (depth > 0 && r() < 0.25) branch(px, py, ang + (r() - 0.5) * 1.8, len * 0.45, w * 0.6, depth - 1);
      }
    };
    for (let i = 0; i < 9; i++) branch(128, 128, (i / 9) * Math.PI * 2 + r() * 0.5, 70 + r() * 50, 4, 2);
  });
}
