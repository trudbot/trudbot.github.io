/*
 * Deep-space backdrops shared by the universe and the ending: a nebula sky
 * dome and a spiral galaxy made of points.
 */
import * as THREE from "three";
import { rng } from "../render/util.ts";

const NEB_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
const NEB_FS = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uTime;
uniform float uWarp;
varying vec3 vDir;
float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; }
  return s;
}
void main() {
  vec3 d = vDir * 2.2;
  // Domain warp gives the gas its swirl; uWarp twists it during the climax.
  vec3 q = vec3(fbm(d + uTime * 0.02), fbm(d + 5.2), fbm(d - 3.1));
  float n = fbm(d + q * (1.6 + uWarp * 2.0));
  float m = smoothstep(0.35, 0.85, n);
  vec3 c = mix(uA, uB, smoothstep(0.2, 0.7, n));
  c = mix(c, uC, m * m);
  c *= 0.25 + 0.9 * m;
  gl_FragColor = vec4(c, 1.0);
}
`;

export function nebula(a: number, b: number, c: number) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: new THREE.Color(a) },
      uB: { value: new THREE.Color(b) },
      uC: { value: new THREE.Color(c) },
      uTime: { value: 0 },
      uWarp: { value: 0 },
    },
    vertexShader: NEB_VS,
    fragmentShader: NEB_FS,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  return m;
}

const GAL_VS = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uScale;
uniform float uBright;
varying vec3 vColor;
void main() {
  vColor = aColor * uBright;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const GAL_FS = /* glsl */ `
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float a = max(0.0, 1.0 - dot(p, p));
  gl_FragColor = vec4(vColor * a, a);
}
`;

/** A flat spiral of additive points in the XZ plane, `radius` across. */
export function galaxy(n: number, radius: number, seed: number, arms = 3, core = 0xffeaa7, edge = 0xa78bfa) {
  const r = rng(seed);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const cc = new THREE.Color(core), ce = new THREE.Color(edge), pink = new THREE.Color(0xff8fab), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = Math.pow(r(), 1.6);
    const arm = Math.floor(r() * arms);
    const a = arm * ((Math.PI * 2) / arms) + t * 5.5 + (r() - 0.5) * 0.5 * (1 - t * 0.5);
    const rad = t * radius;
    const s = (r() - 0.5) * radius * 0.06 * (1.2 - t);
    pos.set([Math.cos(a) * rad + s, (r() - 0.5) * radius * 0.04 * (1 - t), Math.sin(a) * rad + s], i * 3);
    c.copy(cc).lerp(ce, Math.min(1, t * 1.4));
    if (r() < 0.12) c.lerp(pink, 0.7);
    c.multiplyScalar(0.4 + r() * 0.7);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = (1 - t) * 3 + r() * 1.5 + 0.5;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: radius * 6 }, uBright: { value: 1 } },
    vertexShader: GAL_VS,
    fragmentShader: GAL_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const p = new THREE.Points(g, mat);
  p.renderOrder = -8;
  p.frustumCulled = false;
  return p;
}
