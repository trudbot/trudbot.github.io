/*
 * Desert canyon at golden hour: mesas, sand, cacti and one great boulder.
 * Each hit opens the crack wider; the finale splits it into heavy chunks
 * that thud into the sand.
 */
import * as THREE from "three";
import { shot } from "../render/camera.ts";
import { addOutline, toon } from "../render/materials.ts";
import { displace, fbm, rng } from "../render/util.ts";
import { Breakable, disc, lights, sky, World, type Hit } from "./common.ts";
import { burst, type Palette } from "./impact.ts";

const ROCK: Palette = { body: [0x9a6b5a, 0x7d5446, 0xb5806a], inner: [0xffa94d, 0xe8b48c], dust: [0xe8c49a, 0xd9a877], spark: [0xffd166, 0xfffffe] };

export function rockGeo(radius: number, detail: number, seed: number, rough = 0.18, squash = 0.85) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  g.scale(1, squash, 1);
  const o = seed * 7.3;
  return displace(g, (p) => radius * (rough * fbm(p.x * 1.6 / radius + o, p.y * 1.6 / radius, p.z * 1.6 / radius, 3) + 0.06 * Math.abs(fbm(p.x * 5 + o, p.y * 5, p.z * 5, 2))));
}

function mesa(w: number, h: number, d: number, seed: number, mat: THREE.Material) {
  const g = new THREE.CylinderGeometry(w * 0.85, w, h, 9, 4);
  const geo = displace(g, (p) => (Math.abs(p.y) < h * 0.49 ? 0.3 * fbm(p.x * 0.4 + seed, p.y * 0.8, p.z * 0.4, 3) * w : 0));
  const m = new THREE.Mesh(geo, mat);
  m.scale.z = d / w;
  m.position.y = h / 2 - 0.2;
  m.castShadow = m.receiveShadow = true;
  return m;
}

export class CanyonWorld extends World {
  readonly id = "boulder" as const;
  readonly material = "rock" as const;
  readonly scale = 0.3;
  readonly unit = 0.75;
  readonly face = new THREE.Vector2(1.55, 1.25);
  readonly shots = {
    title: shot([3.2, 1.45, 4.6], [0.75, 1.05, 0], 36, 1.8),
    idle: shot([1.4, 1.7, 6.0], [1.4, 1.05, 0], 38, 2.4),
    charge: shot([0.9, 1.3, 4.8], [1.2, 1.25, 0], 40, 2.0),
    over: shot([0.5, 0.9, 3.9], [1.1, 1.35, 0], 44, 1.8),
    final: shot([-1.4, 0.35, 3.6], [1.4, 1.3, 0], 50, 2.4, -0.05),
    impact: shot([3.8, 1.2, 5.2], [2.2, 0.8, 0], 44, 2.6),
    result: shot([-0.6, 1.7, 5.2], [1.1, 1.2, 0], 42, 2.4),
    arrive: shot([2.0, 5.5, 14], [1.6, 1, 0], 42, 3.5),
  };
  private boulder!: Breakable;
  private cracks = 0;

  protected build() {
    const g = this.group;
    g.add(sky({ top: 0x5a6aa8, mid: 0xffa94d, bottom: 0xc97a4a, sun: 0xffd166, sunDir: new THREE.Vector3(0.8, 0.12, -1), sunSize: 4 }));
    this.background.set(0xffa94d);
    this.fog = new THREE.Fog(0xf2a66a, 16, 70);
    this.dustColor = 0xd9a877;
    const sand = disc(80, { color: 0xe8b48c, rim: 0 });
    g.add(sand);
    const dune = toon({ color: 0xd9a070, rim: 0.2 });
    const r = rng(17);
    for (let i = 0; i < 9; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), dune);
      d.scale.set(3 + r() * 4, 0.4 + r() * 0.5, 2 + r() * 3);
      d.position.set(-8 + r() * 26, -0.05, -6 - r() * 14);
      d.receiveShadow = true;
      g.add(d);
    }
    const mesaMat = toon({ color: 0xc8603a, rim: 0.45, rimColor: 0xffd166 });
    const bandMat = toon({ color: 0xa04a30, rim: 0.3 });
    for (const [x, z, w, h, sd] of [[8, -16, 4, 6, 1], [-6, -20, 5, 8, 2], [18, -10, 3, 5, 3], [3, -28, 7, 11, 4], [-14, -9, 3, 4, 5]] as const) {
      const m = mesa(w, h, w * 0.8, sd, sd % 2 ? mesaMat : bandMat);
      m.position.x = x;
      m.position.z = z;
      g.add(m);
    }
    const cactus = toon({ color: 0x3fa37a, rim: 0.5, rimColor: 0x7dffc7 });
    for (const [x, z, s] of [[-1.5, -2.2, 1], [4.6, -3, 0.8], [-3.5, 1.5, 0.7], [6, 2.2, 0.9]] as const) {
      const c = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.1, 4, 10), cactus);
      trunk.position.y = 0.7;
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.4, 4, 8), cactus);
      arm.position.set(0.25, 0.85, 0);
      const elbow = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 4, 8), cactus);
      elbow.rotation.z = Math.PI / 2;
      elbow.position.set(0.15, 0.62, 0);
      for (const m of [trunk, arm, elbow]) {
        m.castShadow = true;
        addOutline(m, 0.02);
        c.add(m);
      }
      c.position.set(x, 0, z);
      c.scale.setScalar(s);
      g.add(c);
    }
    for (let i = 0; i < 14; i++) {
      const p = new THREE.Mesh(rockGeo(0.12 + r() * 0.25, 1, i), toon({ color: 0x9a6b5a, rim: 0.3 }));
      p.position.set(-4 + r() * 12, 0.05, -4 + r() * 7);
      if (Math.abs(p.position.z) < 1.2 && p.position.x > -1 && p.position.x < 4) continue;
      p.castShadow = p.receiveShadow = true;
      g.add(p);
    }
    lights(g, { sky: 0xffd6a5, ground: 0xc8603a, hemi: 0.9, key: 0xffc58a, keyI: 3, dir: [6, 5, 4], rim: 0xff8fab, rimI: 1.2, shadow: 6 });

    this.boulder = new Breakable(
      rockGeo(0.95, 3, 2, 0.2, 0.82),
      { color: 0x9a6b5a, interior: 0xffa94d, crack: 0xffa94d, crackScale: 0.32, rim: 0.5, rimColor: 0xffd166 },
      11,
      9,
      new THREE.Vector3(0, 0, 0),
      0.75,
    );
    this.boulder.obj.position.set(2.3, 0.72, 0);
    addOutline(this.boulder.intact, 0.02);
    this.group.add(this.boulder.obj);
  }

  reset() {
    this.clearTimers();
    this.boulder.reset();
    this.cracks = 0;
  }

  private local() {
    return this.boulder.obj.worldToLocal(this.impact());
  }

  hit(h: Hit) {
    const at = this.impact();
    this.cracks++;
    this.boulder.crack(this.local(), 0.55 + 0.45 * this.cracks + 0.3 * h.power, 1.2 + this.cracks);
    this.boulder.dentAt(this.local(), 0.06 + 0.03 * this.cracks, 0.35);
    burst(this.ctx.fx, "rock", at, new THREE.Vector3(-0.4, 1, 0), 0.4, h.power * 0.7, ROCK, 0);
    this.ctx.fx.ring(new THREE.Vector3(at.x, 0.03, 0), new THREE.Vector3(0, 1, 0), 2.5, 0xffd166, 0.5, 0.6);
    this.ctx.fx.decal(new THREE.Vector3(1.6, 0, 0), 1.2 + 0.4 * this.cracks, 11 + this.cracks);
    this.ctx.shake(0.35 + 0.2 * h.power, 2.5);
    this.ctx.pulse(at, { ripple: 0.5 + 0.3 * h.power, aberr: 0.006 });
  }

  finale(h: Hit) {
    const at = this.impact();
    this.boulder.crack(this.local(), 3, 4);
    this.boulder.shatter(this.ctx.fx, at.clone().add(new THREE.Vector3(-0.4, 0.4, 0)), { speed: 3 + 2.5 * h.power, up: 0.55, spin: 4, ground: -0.5, gravity: 14, stagger: 0.03 });
    burst(this.ctx.fx, "rock", at, new THREE.Vector3(0.7, 0.7, 0), this.unit, h.power, ROCK, 0);
    // Dust wall rolling outward along the ground.
    this.ctx.fx.puff(new THREE.Vector3(2.3, 0.2, 0), 40, { color: ROCK.dust, size: 1.2, grow: 3, speed: 4, life: 2.6, drag: 1.6, alpha: 0.65, dir: new THREE.Vector3(1, 0.1, 0), cone: 2.6, radius: 0.8 });
    this.ctx.fx.ring(new THREE.Vector3(2.3, 0.04, 0), new THREE.Vector3(0, 1, 0), 9, 0xffeaa7, 0.9);
    this.ctx.fx.decal(new THREE.Vector3(2.2, 0, 0), 4.2, 19);
    this.ctx.fx.flash(at, 0xffeaa7, 4);
    this.ctx.shake(0.75, 7);
    this.ctx.pulse(at, { flash: 0.3 * h.power, ripple: 1, blur: 0.04 * h.power, aberr: 0.015 });
    // Second wave: the heavy halves land a beat later.
    this.after(0.55, () => {
      this.ctx.shake(0.35);
      this.ctx.fx.puff(new THREE.Vector3(3.2, 0.1, 0), 18, { color: ROCK.dust, size: 0.9, grow: 3, speed: 2.5, life: 2, drag: 2, alpha: 0.6, radius: 1.2 });
    });
  }

  update(dt: number) {
    super.update(dt);
    this.boulder.update(dt);
  }
}
