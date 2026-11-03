/*
 * Earth seen from the Moon. The planet is fully procedural: continents from
 * spherical noise painted into an equirectangular canvas, a drifting cloud
 * shell and a fresnel atmosphere. The finale cracks the crust open to a
 * molten core and the plates drift apart in zero gravity.
 */
import * as THREE from "three";
import { shot } from "../render/camera.ts";
import { addOutline, toon } from "../render/materials.ts";
import { canvasTex, fbm, rng } from "../render/util.ts";
import { Breakable, lights, sky, stars, World, type Hit } from "./common.ts";
import { burst, type Palette } from "./impact.ts";

const CRUST: Palette = { body: [0x3fa37a, 0x2f6fb0, 0xe8c49a, 0xfffffe], inner: [0xffa94d, 0xff6b9d], dust: [0xfffffe, 0xb5f5ec], spark: [0xffd166, 0xffa94d, 0xfffffe] };

function planetTex(w: number, h: number, clouds: boolean) {
  return canvasTex(w, h, (c) => {
    const img = c.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const lat = (y / h - 0.5) * Math.PI;
      for (let x = 0; x < w; x++) {
        const lon = (x / w) * Math.PI * 2;
        const px = Math.cos(lat) * Math.cos(lon), py = Math.sin(lat), pz = Math.cos(lat) * Math.sin(lon);
        const i = (y * w + x) * 4;
        if (clouds) {
          const n = fbm(px * 3 + 9, py * 5, pz * 3, 4);
          const a = Math.max(0, n - 0.05) * 2.6;
          d[i] = d[i + 1] = d[i + 2] = 255;
          d[i + 3] = Math.min(230, a * 255);
          continue;
        }
        const n = fbm(px * 1.8, py * 1.8, pz * 1.8, 5);
        const ice = Math.abs(py) > 0.88 - 0.05 * n;
        let col: [number, number, number];
        if (ice) col = [244, 248, 255];
        else if (n > 0.04) {
          // Land: green lowlands, ochre highlands; banded so it reads cartoon-flat.
          col = n > 0.22 ? [232, 196, 154] : n > 0.12 ? [92, 170, 110] : [63, 163, 122];
        } else col = n > -0.02 ? [92, 200, 230] : n > -0.15 ? [47, 111, 176] : [38, 82, 150];
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  });
}

const ATMO_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const ATMO_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uPower;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(vN, vV)), 2.5);
  gl_FragColor = vec4(uColor * uPower, f * uPower);
}
`;

export function atmosphere(radius: number, color: THREE.ColorRepresentation) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: 1 } },
    vertexShader: ATMO_VS,
    fragmentShader: ATMO_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
}

export class EarthWorld extends World {
  readonly id = "earth" as const;
  readonly material = "planet" as const;
  readonly scale = 0.75;
  readonly unit = 1.5;
  readonly face = new THREE.Vector2(2.13, 1.85);
  readonly shots = {
    title: shot([3.2, 1.45, 4.6], [0.75, 1.05, 0], 36, 2),
    idle: shot([0.4, 2.2, 7.4], [2.2, 1.5, 0], 40, 3.4),
    charge: shot([0.2, 1.6, 5.8], [1.8, 1.6, 0], 42, 2.8),
    over: shot([-0.6, 1.1, 4.6], [1.5, 1.7, 0], 46, 2.4),
    final: shot([-2.4, 0.4, 4.2], [2.4, 1.8, 0], 54, 3.2, 0.07),
    impact: shot([1.5, 3, 16], [3.6, 1.6, 0], 44, 6.5),
    result: shot([-1, 2.4, 7.5], [1.8, 1.5, 0], 42, 3.4),
    arrive: shot([3, 6, 30], [3, 1.5, 0], 42, 9),
  };
  private earth!: Breakable;
  private clouds!: THREE.Mesh;
  private atmo!: THREE.Mesh;
  private core!: THREE.Mesh;
  private spin = new THREE.Group();
  private broken = 0;

  protected build() {
    const g = this.group;
    g.add(sky({ top: 0x05060f, mid: 0x111530, bottom: 0x05060f, sun: 0xffeaa7, sunDir: new THREE.Vector3(-0.6, 0.35, 0.8), sunSize: 1.2 }));
    g.add(stars(2500, 1400, 9, 2));
    this.background.set(0x05060f);
    this.dustColor = 0xb8b6c8;
    this.shakeScale = 1.2;

    const moonGeo = new THREE.SphereGeometry(30, 96, 48);
    const pos = moonGeo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const r = rng(3);
    const craters = Array.from({ length: 40 }, () => new THREE.Vector3(r() * 16 - 6, 0, r() * 16 - 8));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let k = 0.72 + 0.12 * fbm(x * 0.4, 0, z * 0.4, 3);
      for (const c of craters) if (Math.hypot(x - c.x, z - c.z) < 0.6 + (c.x % 1) * 0.5) k -= 0.12;
      col.set([k, k * 0.98, k * 1.05], i * 3);
    }
    moonGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const moon = new THREE.Mesh(moonGeo, toon({ color: 0xd8d6e8, vertexColors: true, rim: 0.3, rimColor: 0xa78bfa }));
    moon.position.y = -30;
    moon.receiveShadow = true;
    g.add(moon);
    const flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7), toon({ color: 0xfffffe }));
    pole.position.y = 0.35;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), toon({ color: 0xff6b9d, side: THREE.DoubleSide }));
    cloth.position.set(0.16, 0.58, 0);
    flag.add(pole, cloth);
    flag.position.set(-1.4, 0, -1.2);
    g.add(flag);

    lights(g, { sky: 0x818cf8, ground: 0x1a1a2e, hemi: 0.45, key: 0xfff1d6, keyI: 3.4, dir: [-5, 4, 6], rim: 0x5ce0d8, rimI: 2, shadow: 6, center: new THREE.Vector3(1.8, 1, 0) });

    this.spin.position.set(3.6, 1.6, 0);
    g.add(this.spin);
    const sphere = new THREE.SphereGeometry(1.5, 64, 40);
    this.earth = new Breakable(sphere, { color: 0xffffff, map: planetTex(512, 256, false), interior: 0xff6b4d, crack: 0xffa94d, crackScale: 0.55, rim: 0.4, rimColor: 0x7dd3fc }, 16, 12, new THREE.Vector3(), 0.7);
    this.earth.intact.castShadow = false;
    addOutline(this.earth.intact, 0.02);
    this.spin.add(this.earth.obj);
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.54, 48, 32), toon({ color: 0xffffff, map: planetTex(512, 256, true), transparent: true, rim: 0.2 }));
    this.spin.add(this.clouds);
    this.atmo = atmosphere(1.75, 0x7dd3fc);
    this.atmo.position.copy(this.spin.position);
    g.add(this.atmo);
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd166).multiplyScalar(3) }));
    this.core.position.copy(this.spin.position);
    g.add(this.core);
  }

  reset() {
    this.clearTimers();
    this.earth.reset();
    this.broken = 0;
    this.clouds.visible = true;
    this.clouds.scale.setScalar(1);
    (this.atmo.material as THREE.ShaderMaterial).uniforms.uPower.value = 1;
    this.atmo.scale.setScalar(1);
    this.core.visible = false;
    this.core.scale.setScalar(1);
  }

  private local() {
    return this.earth.obj.worldToLocal(this.impact());
  }

  hit(h: Hit) {
    const at = this.impact();
    this.broken++;
    this.earth.crack(this.local(), 0.9 + 0.7 * this.broken, 2 + this.broken);
    this.earth.dentAt(this.local(), 0.1, 0.5);
    burst(this.ctx.fx, "planet", at, new THREE.Vector3(-1, 0.3, 0), 0.5, h.power * 0.7, CRUST);
    this.ctx.fx.ring(this.spin.position.clone(), new THREE.Vector3(0.2, 0.3, 1), 2.6 + 0.4 * this.broken, 0x7dd3fc, 0.8, 0.8);
    this.ctx.fx.decal(new THREE.Vector3(0.9, 0, 0), 1.6, 41 + this.broken, "rgba(40,30,70,0.85)");
    this.ctx.shake(0.45 + 0.2 * h.power, 3);
    this.ctx.pulse(at, { ripple: 0.7, aberr: 0.01 });
  }

  finale(h: Hit) {
    const at = this.impact();
    this.earth.crack(this.local(), 4, 6);
    this.core.visible = true;
    this.after(0.12, () => {
      this.earth.shatter(this.ctx.fx, this.spin.position.clone(), { speed: 0.9 + 0.8 * h.power, up: 0, spin: 0.8, gravity: 0, drag: 0.15 });
      this.clouds.visible = false;
    });
    burst(this.ctx.fx, "planet", at, new THREE.Vector3(1, 0.2, 0), this.unit, h.power, CRUST);
    burst(this.ctx.fx, "planet", this.spin.position.clone(), new THREE.Vector3(1, 0, 0), this.unit, h.power, CRUST);
    // The atmosphere tears off as an expanding ring.
    this.ctx.fx.ring(this.spin.position.clone(), new THREE.Vector3(0.15, 0.25, 1), 9, 0x7dd3fc, 1.6);
    this.ctx.fx.ring(this.spin.position.clone(), new THREE.Vector3(0, 1, 0.2), 6, 0xffa94d, 1.2);
    this.ctx.fx.flash(this.spin.position.clone(), 0xffd166, 8, 0.5);
    this.ctx.shake(1, 10);
    this.ctx.pulse(at, { flash: 0.45 * h.power, color: 0xffeaa7, ripple: 1, blur: 0.06, aberr: 0.025 });
    this.after(1.4, () => this.ctx.shake(0.3));
  }

  update(dt: number) {
    super.update(dt);
    this.earth.update(dt);
    if (!this.earth.broken) {
      this.spin.rotation.y += dt * 0.08;
      this.clouds.rotation.y += dt * 0.03;
    }
    if (this.core.visible) {
      this.core.scale.setScalar(1 + 0.06 * Math.sin(this.t * 9));
      const u = (this.atmo.material as THREE.ShaderMaterial).uniforms.uPower;
      u.value = Math.max(0, u.value - dt * 0.5);
      this.atmo.scale.multiplyScalar(1 + dt * 0.6);
    }
  }
}
