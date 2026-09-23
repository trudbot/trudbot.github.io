import * as THREE from "three";

export const Sprite = { Dot: 0, Heart: 1, Star: 2, Note: 3 } as const;
export type Sprite = (typeof Sprite)[keyof typeof Sprite];

let atlas: THREE.CanvasTexture | null = null;

function spriteAtlas() {
  if (atlas) return atlas;
  const cell = 64;
  const canvas = document.createElement("canvas");
  canvas.width = cell * 4;
  canvas.height = cell;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";

  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.55, "rgba(255,255,255,0.9)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, cell, cell);

  ctx.fillStyle = "#fff";
  ctx.save();
  ctx.translate(cell + 32, 36);
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.bezierCurveTo(-30, -2, -18, -26, 0, -10);
  ctx.bezierCurveTo(18, -26, 30, -2, 0, 18);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cell * 2 + 32, 34);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 28 : 12;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cell * 3, 0);
  ctx.beginPath();
  ctx.ellipse(22, 46, 11, 8, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(29, 10, 5, 36);
  ctx.beginPath();
  ctx.moveTo(29, 10);
  ctx.quadraticCurveTo(48, 14, 50, 30);
  ctx.quadraticCurveTo(44, 20, 34, 20);
  ctx.fill();
  ctx.restore();

  atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  return atlas;
}

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSprite;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying float vSprite;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    vAlpha = aAlpha;
    vSprite = aSprite;
    vColor = aColor;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uAtlas;
  varying float vAlpha;
  varying float vSprite;
  varying vec3 vColor;
  void main() {
    vec2 uv = vec2((gl_PointCoord.x + vSprite) / 4.0, 1.0 - gl_PointCoord.y);
    vec4 tex = texture2D(uAtlas, uv);
    float a = tex.a * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor * tex.rgb, a);
    #include <colorspace_fragment>
  }
`;

export interface EmitOptions {
  pos: THREE.Vector3 | { x: number; y: number; z: number };
  count?: number;
  spread?: number;
  /** Base velocity; random jitter of `speed` is added on top in all directions. */
  vel?: [number, number, number];
  speed?: number;
  colors: THREE.ColorRepresentation[];
  size?: number;
  life?: number;
  gravity?: number;
  drag?: number;
  sprite?: Sprite;
  /** Particles grow over their lifetime instead of shrinking (smoke). */
  grow?: boolean;
}

export class Particles {
  readonly points: THREE.Points;
  private readonly cap: number;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly color: Float32Array;
  private readonly size: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly alpha: Float32Array;
  private readonly sprite: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly grow: Uint8Array;
  private readonly material: THREE.ShaderMaterial;
  private cursor = 0;
  private readonly tmpColor = new THREE.Color();

  constructor(capacity: number, blending: THREE.Blending = THREE.NormalBlending) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.sprite = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grow = new Uint8Array(capacity);

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSprite", new THREE.BufferAttribute(this.sprite, 1).setUsage(THREE.DynamicDrawUsage));

    this.material = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: spriteAtlas() }, uScale: { value: 400 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setViewportHeight(px: number) {
    this.material.uniforms.uScale.value = px * 0.5;
  }

  emit(o: EmitOptions) {
    const count = o.count ?? 1;
    const spread = o.spread ?? 0;
    const speed = o.speed ?? 0;
    const [bvx, bvy, bvz] = o.vel ?? [0, 0, 0];
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.cap;
      const i3 = i * 3;
      this.pos[i3] = o.pos.x + (Math.random() - 0.5) * spread;
      this.pos[i3 + 1] = o.pos.y + (Math.random() - 0.5) * spread;
      this.pos[i3 + 2] = o.pos.z + (Math.random() - 0.5) * spread;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.vel[i3] = bvx + Math.sin(phi) * Math.cos(theta) * s;
      this.vel[i3 + 1] = bvy + Math.abs(Math.cos(phi)) * s;
      this.vel[i3 + 2] = bvz + Math.sin(phi) * Math.sin(theta) * s;
      this.tmpColor.set(o.colors[Math.floor(Math.random() * o.colors.length)]);
      this.color[i3] = this.tmpColor.r;
      this.color[i3 + 1] = this.tmpColor.g;
      this.color[i3 + 2] = this.tmpColor.b;
      const life = (o.life ?? 1) * (0.7 + Math.random() * 0.6);
      this.life[i] = life;
      this.maxLife[i] = life;
      this.baseSize[i] = (o.size ?? 0.3) * (0.7 + Math.random() * 0.6);
      this.sprite[i] = o.sprite ?? Sprite.Dot;
      this.gravity[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0;
      this.grow[i] = o.grow ? 1 : 0;
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const i3 = i * 3;
      const damp = 1 - Math.min(1, this.drag[i] * dt);
      this.vel[i3] *= damp;
      this.vel[i3 + 1] = this.vel[i3 + 1] * damp - this.gravity[i] * dt;
      this.vel[i3 + 2] *= damp;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 8) * (1 - t * t);
      this.size[i] = this.baseSize[i] * (this.grow[i] ? 0.6 + t * 1.2 : 1 - t * 0.5);
    }
    const attrs = this.points.geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.aColor.needsUpdate = true;
    attrs.aSize.needsUpdate = true;
    attrs.aAlpha.needsUpdate = true;
    attrs.aSprite.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
