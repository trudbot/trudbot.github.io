/*
 * Renderer and the full-screen composite. The scene renders into an MSAA
 * half-float target so emissive cracks and flashes keep their range until
 * the final pass tone-maps them. The composite adds the impact language:
 * a ripple from the hit, radial blur, chromatic split, flash and fail
 * desaturation. `shatter` breaks a frozen frame into flying shards for the
 * universe finale.
 */
import * as THREE from "three";

const FULL_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const POST_FS = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uRes;
uniform vec4 uRipple;   // xy centre (uv), z age (s), w strength
uniform float uBlur;    // radial blur toward uRipple.xy
uniform float uAberr;
uniform float uVignette;
uniform vec3 uFlash;
uniform float uFlashAmt;
uniform float uDesat;
uniform float uExposure;
varying vec2 vUv;

vec3 sampleScene(vec2 uv) {
  vec2 d = (uv - 0.5) * uAberr;
  return vec3(texture2D(tScene, uv - d).r, texture2D(tScene, uv).g, texture2D(tScene, uv + d).b);
}

void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  if (uRipple.w > 0.0) {
    vec2 rel = (uv - uRipple.xy) * asp;
    float r = length(rel);
    float front = uRipple.z * 1.4;
    float band = exp(-pow((r - front) * 9.0, 2.0));
    uv -= normalize(rel + 1e-5) / asp * band * uRipple.w * 0.045 * exp(-uRipple.z * 1.5);
  }
  vec3 col = sampleScene(uv);
  if (uBlur > 0.001) {
    vec2 dir = (uv - uRipple.xy) * uBlur;
    for (int i = 1; i <= 7; i++) col += sampleScene(uv - dir * float(i) / 7.0);
    col /= 8.0;
  }
  col *= uExposure;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(l), uDesat);
  vec2 v = (vUv - 0.5) * asp;
  col *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(v));
  col = mix(col, uFlash, clamp(uFlashAmt, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const SHARD_VS = /* glsl */ `
attribute vec3 aCenter;
attribute vec3 aRand;
uniform float uT;
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  // Shards near the impact leave first; each spins about its own centre.
  float delay = length(aCenter.xy - vec2(0.15, 0.1)) * 0.35 * aRand.z;
  float t = max(0.0, uT - delay);
  vec2 p = position.xy - aCenter.xy;
  float a = t * (aRand.x - 0.5) * 7.0;
  p = mat2(cos(a), sin(a), -sin(a), cos(a)) * p * (1.0 - 0.25 * min(t, 1.0));
  vec2 dir = normalize(aCenter.xy - vec2(0.15, 0.1) + (aRand.xy - 0.5) * 0.4 + 1e-4);
  vec2 off = dir * (t * 0.9 + t * t * 1.6) + vec2(0.0, -t * t * 1.2);
  vShade = 1.0 - 0.35 * abs(sin(a));
  gl_Position = vec4(aCenter.xy + p + off, 0.0, 1.0);
}
`;

const SHARD_FS = /* glsl */ `
uniform sampler2D tFrame;
varying vec2 vUv;
varying float vShade;
void main() {
  vec3 c = texture2D(tFrame, vUv).rgb * vShade;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function shardGeometry(seed: number) {
  // Jittered grid, each cell split into two triangles: irregular glass shards.
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const nx = 7, ny = 11;
  const pts: number[][] = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const edge = i === 0 || j === 0 || i === nx || j === ny;
      pts.push([
        -1 + (2 * i) / nx + (edge && (i === 0 || i === nx) ? 0 : (r() - 0.5) * (1.5 / nx)),
        -1 + (2 * j) / ny + (edge && (j === 0 || j === ny) ? 0 : (r() - 0.5) * (1.5 / ny)),
      ]);
    }
  const pos: number[] = [], center: number[] = [], rand: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
    const rr = [r(), r(), 0.6 + r() * 0.8];
    for (const p of [a, b, c]) {
      pos.push(p[0], p[1], 0);
      center.push(cx, cy, 0);
      rand.push(...rr);
    }
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = pts[j * (nx + 1) + i], b = pts[j * (nx + 1) + i + 1];
      const c = pts[(j + 1) * (nx + 1) + i], d = pts[(j + 1) * (nx + 1) + i + 1];
      if (r() < 0.5) tri(a, b, d), tri(a, d, c);
      else tri(a, b, c), tri(b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aCenter", new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute("aRand", new THREE.Float32BufferAttribute(rand, 3));
  return g;
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  private rt: THREE.WebGLRenderTarget;
  private frozen: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postScene = new THREE.Scene();
  private shardScene = new THREE.Scene();
  private shardMat: THREE.ShaderMaterial;
  readonly u = {
    tScene: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uRipple: { value: new THREE.Vector4(0.5, 0.5, 0, 0) },
    uBlur: { value: 0 },
    uAberr: { value: 0 },
    uVignette: { value: 0.45 },
    uFlash: { value: new THREE.Color(1, 1, 1) },
    uFlashAmt: { value: 0 },
    uDesat: { value: 0 },
    uExposure: { value: 1 },
  };
  /** Seconds since the screen broke, or null while it is whole. */
  shatterT: number | null = null;
  private w = 1;
  private h = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    const opts = { type: THREE.HalfFloatType, samples: 4, depthBuffer: true };
    this.rt = new THREE.WebGLRenderTarget(1, 1, opts);
    this.frozen = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.u.tScene.value = this.rt.texture;
    const post = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: FULL_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
    this.quad.frustumCulled = false;
    this.postScene.add(this.quad);
    this.shardMat = new THREE.ShaderMaterial({
      uniforms: { tFrame: { value: this.frozen.texture }, uT: { value: 0 } },
      vertexShader: SHARD_VS,
      fragmentShader: SHARD_FS,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const shards = new THREE.Mesh(shardGeometry(7), this.shardMat);
    shards.frustumCulled = false;
    this.shardScene.add(shards);
  }

  resize(w: number, h: number) {
    // Phones get a lower cap: fill rate, not geometry, is the bottleneck there.
    const dpr = Math.min(window.devicePixelRatio || 1, Math.min(w, h) < 600 ? 1.75 : 2);
    this.w = w;
    this.h = h;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    this.rt.setSize(pw, ph);
    this.frozen.setSize(pw, ph);
    this.u.uRes.value.set(pw, ph);
  }

  get aspect() {
    return this.w / Math.max(1, this.h);
  }

  /** Projects a world point to composite uv, for centring the ripple on the hit. */
  toUv(p: THREE.Vector3, cam: THREE.Camera) {
    const v = p.clone().project(cam);
    return new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
  }

  render(scene: THREE.Scene, cam: THREE.Camera) {
    const gl = this.gl;
    gl.setRenderTarget(this.rt);
    gl.render(scene, cam);
    gl.setRenderTarget(null);
    gl.render(this.postScene, this.ortho);
    if (this.shatterT !== null) {
      this.shardMat.uniforms.uT.value = this.shatterT;
      gl.autoClear = false;
      gl.render(this.shardScene, this.ortho);
      gl.autoClear = true;
    }
  }

  /**
   * Freezes the current composite onto glass shards; whatever renders next
   * shows through the gaps as they fly off.
   */
  shatter(scene: THREE.Scene, cam: THREE.Camera) {
    const gl = this.gl;
    gl.setRenderTarget(this.rt);
    gl.render(scene, cam);
    gl.setRenderTarget(this.frozen);
    // Off-screen, three skips tone mapping, so the frame stays linear HDR
    // and the shard pass maps it exactly like the live composite.
    gl.render(this.postScene, this.ortho);
    gl.setRenderTarget(null);
    this.shatterT = 0;
  }

  clearShatter() {
    this.shatterT = null;
  }
}
