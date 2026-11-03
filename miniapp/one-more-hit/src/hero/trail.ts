/*
 * Smear ribbon behind the hammer head. It samples the head's inner and outer
 * edge each frame in world space and fades by sample age, so a fast swing
 * leaves a wide arc and a slow one barely any.
 */
import * as THREE from "three";

const N = 16;
const LIFE = 0.12;

export class Trail {
  readonly obj: THREE.Mesh;
  private pts: { a: THREE.Vector3; b: THREE.Vector3; age: number }[] = [];
  private pos = new Float32Array(N * 2 * 3);
  private alpha = new Float32Array(N * 2);
  private mat: THREE.ShaderMaterial;

  constructor(color: THREE.ColorRepresentation = 0xfffffe) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uBoost: { value: 1 } },
      vertexShader: `attribute float aAlpha; varying float vA;
        void main() { vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uBoost; varying float vA;
        void main() { gl_FragColor = vec4(uColor * uBoost, vA * 0.75); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.obj = new THREE.Mesh(g, this.mat);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = 3;
  }

  setColor(c: THREE.ColorRepresentation, boost = 1) {
    this.mat.uniforms.uColor.value.set(c);
    this.mat.uniforms.uBoost.value = boost;
  }

  update(dt: number, head: THREE.Object3D, active: boolean) {
    for (const p of this.pts) p.age += dt;
    if (active) {
      // Edges sampled across the head and down the handle give a fan-shaped smear.
      this.pts.unshift({ a: head.localToWorld(new THREE.Vector3(0.3, 0, 0)), b: head.localToWorld(new THREE.Vector3(-0.55, 0, 0)), age: 0 });
    }
    this.pts = this.pts.filter((p) => p.age < LIFE).slice(0, N);
    const n = this.pts.length;
    this.obj.visible = n > 1;
    for (let i = 0; i < N; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      if (!p) break;
      this.pos.set([p.a.x, p.a.y, p.a.z], i * 6);
      this.pos.set([p.b.x, p.b.y, p.b.z], i * 6 + 3);
      const k = i < n ? 1 - p.age / LIFE : 0;
      this.alpha[i * 2] = k;
      this.alpha[i * 2 + 1] = 0;
    }
    const g = this.obj.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  clear() {
    this.pts = [];
    this.obj.visible = false;
  }
}
