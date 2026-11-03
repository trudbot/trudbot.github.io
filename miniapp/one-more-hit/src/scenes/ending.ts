/*
 * After the universe breaks: a quiet void where the shards drift and a new
 * galaxy spins up from the last spark. Nothing to hit; it frames the ending.
 */
import * as THREE from "three";
import { shot } from "../render/camera.ts";
import { addOutline, toon } from "../render/materials.ts";
import { rng } from "../render/util.ts";
import { rockGeo } from "./canyon.ts";
import { lights, stars, World } from "./common.ts";
import { galaxy, nebula } from "./space.ts";

export class EndingWorld extends World {
  readonly id = "ending" as const;
  readonly material = "cosmic" as const;
  readonly scale = 0.4;
  readonly unit = 1;
  readonly face = new THREE.Vector2(2, 1.5);
  private view = shot([-2.5, 1.6, 7], [2.5, 2.2, 0], 44, 4);
  readonly shots = {
    title: this.view,
    idle: this.view,
    charge: this.view,
    over: this.view,
    final: this.view,
    impact: this.view,
    result: this.view,
    arrive: shot([-1, 0.8, 4], [1.5, 1.6, 0], 50, 3),
  };
  private gal!: THREE.Points;
  private sky!: THREE.Mesh;
  private shards: { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3 }[] = [];

  protected build() {
    const g = this.group;
    this.sky = nebula(0x05060f, 0x2a2350, 0x5ce0d8);
    g.add(this.sky);
    g.add(stars(1800, 1400, 44, 1.8));
    this.background.set(0x05060f);
    this.gal = galaxy(7000, 6, 13, 4, 0xfffffe, 0x5ce0d8);
    this.gal.position.set(5, 3, -6);
    this.gal.rotation.set(1.05, 0, -0.3);
    g.add(this.gal);
    const rock = new THREE.Mesh(rockGeo(0.9, 2, 9, 0.2, 0.45), toon({ color: 0x7d5446, rim: 0.6, rimColor: 0x5ce0d8 }));
    rock.position.y = -0.38;
    rock.castShadow = rock.receiveShadow = true;
    addOutline(rock, 0.02);
    g.add(rock);
    const r = rng(19);
    const crystal = toon({ color: 0xc4b5fd, emissive: 0x5b3fc4, emissiveIntensity: 0.5, rim: 1, rimColor: 0x5ce0d8 });
    const stone = toon({ color: 0x9a6b5a, rim: 0.5, rimColor: 0xff8fab });
    for (let i = 0; i < 40; i++) {
      const geo = i % 3 ? new THREE.TetrahedronGeometry(0.08 + r() * 0.25) : rockGeo(0.1 + r() * 0.3, 0, i);
      const m = new THREE.Mesh(geo, i % 3 ? crystal : stone);
      m.position.set(-6 + r() * 16, -3 + r() * 8, -8 + r() * 10);
      m.castShadow = true;
      g.add(m);
      this.shards.push({ m, v: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.08), w: new THREE.Vector3(r(), r(), r()).multiplyScalar(0.6) });
    }
    lights(g, { sky: 0xa78bfa, ground: 0x1a1a2e, hemi: 0.7, key: 0xfff1d6, keyI: 2.4, dir: [3, 4, 6], rim: 0x5ce0d8, rimI: 1.8, shadow: 4 });
  }

  reset() {
    this.clearTimers();
    this.gal.scale.setScalar(0.05);
  }

  hit() {}
  finale() {}

  update(dt: number) {
    super.update(dt);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.t;
    // The galaxy unfolds from a point over the first seconds of the ending.
    const s = this.gal.scale.x;
    this.gal.scale.setScalar(s + (1 - s) * (1 - Math.exp(-dt * 0.5)));
    this.gal.rotation.y += dt * 0.12;
    for (const sh of this.shards) {
      sh.m.position.addScaledVector(sh.v, dt);
      sh.m.rotation.x += sh.w.x * dt;
      sh.m.rotation.y += sh.w.y * dt;
    }
  }
}
