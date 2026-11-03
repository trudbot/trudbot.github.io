/*
 * The universe: the hero stands on a drifting chunk of the broken Earth and
 * swings at a crystal orb that holds a whole galaxy. The third hit shatters
 * the shell and the level appears won; then the core wakes up, space bends
 * around it and one more hit is needed to finish everything.
 */
import * as THREE from "three";
import { shot } from "../render/camera.ts";
import { addOutline, toon } from "../render/materials.ts";
import { displace, fbm, glow, rng } from "../render/util.ts";
import { rockGeo } from "./canyon.ts";
import { Breakable, lights, stars, World, type Hit } from "./common.ts";
import { burst, type Palette } from "./impact.ts";
import { galaxy, nebula } from "./space.ts";

const STAR: Palette = { body: [0xc4b5fd, 0xa78bfa, 0x5ce0d8, 0xfffffe], inner: [0xfffffe, 0xb5f5ec], dust: [0xa78bfa, 0xff8fab, 0x5ce0d8], spark: [0xfffffe, 0xffd166, 0xa5f3fc] };
const CENTER = new THREE.Vector3(3.5, 1.7, 0);

/** The Earth chunk: grassy top, layered crust, molten underside. */
function island() {
  const g = new THREE.CylinderGeometry(2.3, 0.25, 2.6, 22, 6);
  g.translate(0, -1.3, 0);
  const geo = displace(g, (p) => (p.y < -0.02 ? 0.35 * fbm(p.x * 0.9, p.y * 0.9, p.z * 0.9, 3) : 0));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x3fa37a), soil = new THREE.Color(0xc8603a), deep = new THREE.Color(0x7d5446), lava = new THREE.Color(0xffa94d), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > -0.05) c.copy(grass);
    else if (y > -0.5) c.copy(soil);
    else c.copy(deep).lerp(lava, Math.min(1, (-y - 0.9) / 1.6));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, toon({ color: 0xffffff, vertexColors: true, rim: 0.6, rimColor: 0xa78bfa }));
  m.castShadow = m.receiveShadow = true;
  addOutline(m, 0.025);
  return m;
}

export class CosmosWorld extends World {
  readonly id = "cosmos" as const;
  readonly material = "cosmic" as const;
  readonly scale = 1;
  readonly unit = 1.4;
  readonly face = new THREE.Vector2(CENTER.x - 1.4, CENTER.y);
  readonly shots = {
    title: shot([3.2, 1.45, 4.6], [0.75, 1.05, 0], 36, 2),
    idle: shot([0.6, 2.4, 7.6], [2.1, 1.4, 0], 40, 3.4),
    charge: shot([0.3, 1.7, 6], [1.9, 1.5, 0], 42, 2.9),
    over: shot([-0.6, 1.1, 4.8], [1.6, 1.7, 0], 48, 2.5),
    final: shot([-2.8, 0.2, 4.4], [2.4, 1.9, 0], 58, 3.4, -0.08),
    impact: shot([1.6, 3.2, 15], [3.4, 1.6, 0], 46, 6),
    result: shot([-1, 2.6, 7.8], [1.9, 1.5, 0], 42, 3.4),
    arrive: shot([4, 7, 34], [3, 1.5, 0], 42, 10),
  };
  private orb!: Breakable;
  private core!: THREE.Mesh;
  private halo!: THREE.Sprite;
  private rings: THREE.Mesh[] = [];
  private sky!: THREE.Mesh;
  private gal!: THREE.Points;
  private rocks: { m: THREE.Mesh; a: number; r: number; y: number; s: number }[] = [];
  private stage: "intact" | "fake" | "awake" | "gone" = "intact";
  private warp = 0;
  private swell = 0;

  protected build() {
    const g = this.group;
    this.sky = nebula(0x0b0820, 0x3d2a7a, 0xff8fab);
    g.add(this.sky);
    g.add(stars(3000, 1400, 21, 2.2));
    this.gal = galaxy(9000, 34, 5);
    this.gal.position.set(16, 14, -70);
    this.gal.rotation.set(0.55, 0, 0.25);
    g.add(this.gal);
    this.background.set(0x0b0820);
    this.dustColor = 0x8a7fb0;
    this.shakeScale = 1.3;

    g.add(island());
    const r = rng(77);
    const rockMat = toon({ color: 0x7d5446, rim: 0.6, rimColor: 0xa78bfa });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(rockGeo(0.12 + r() * 0.35, 1, i + 30), rockMat);
      m.castShadow = true;
      g.add(m);
      this.rocks.push({ m, a: r() * Math.PI * 2, r: 5 + r() * 9, y: -3 + r() * 7, s: 0.02 + r() * 0.05 });
    }
    lights(g, { sky: 0xa78bfa, ground: 0x1a1a2e, hemi: 0.6, key: 0xfff1d6, keyI: 3, dir: [-4, 5, 6], rim: 0xff8fab, rimI: 2.2, shadow: 6, center: new THREE.Vector3(1.8, 1, 0) });

    this.orb = new Breakable(
      new THREE.IcosahedronGeometry(1.4, 2),
      { color: 0xc4b5fd, emissive: 0x5b3fc4, emissiveIntensity: 0.45, interior: 0xfffffe, crack: 0x5ce0d8, crackScale: 0.5, rim: 1.1, rimColor: 0x5ce0d8 },
      18,
      61,
      new THREE.Vector3(),
      0.6,
    );
    this.orb.obj.position.copy(CENTER);
    addOutline(this.orb.intact, 0.02);
    g.add(this.orb.obj);
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d6).multiplyScalar(2.5) }));
    this.core.position.copy(CENTER);
    g.add(this.core);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xa78bfa, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.halo.position.copy(CENTER);
    g.add(this.halo);
    for (const [tx, tz, rad, c] of [[1.2, 0.3, 2.1, 0x5ce0d8], [0.4, -0.6, 2.5, 0xff8fab], [-0.8, 0.2, 2.9, 0xffd166]] as const) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(rad, 0.012, 6, 96),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      ring.position.copy(CENTER);
      ring.rotation.set(tx, 0, tz);
      g.add(ring);
      this.rings.push(ring);
    }
  }

  reset() {
    this.clearTimers();
    this.orb.reset();
    this.orb.obj.rotation.set(0, 0, 0);
    this.stage = "intact";
    this.warp = 0;
    this.swell = 0;
    this.core.visible = false;
    this.core.scale.setScalar(1);
    this.halo.visible = true;
    this.halo.scale.setScalar(5);
    this.halo.material.opacity = 0.35;
    for (const r of this.rings) r.visible = true;
  }

  private local() {
    return this.orb.obj.worldToLocal(this.impact());
  }

  private distort(amount: number) {
    this.warp = Math.max(this.warp, amount);
  }

  hit(h: Hit) {
    const at = this.impact();
    if (h.stage >= 2) return this.fakeEnd(h);
    this.orb.crack(this.local(), 1 + 0.6 * h.power, 2.5);
    this.orb.dentAt(this.local(), 0.08, 0.5);
    burst(this.ctx.fx, "cosmic", at, new THREE.Vector3(-1, 0.4, 0), 0.6, h.power * 0.7, STAR);
    this.ctx.fx.ring(CENTER.clone(), new THREE.Vector3(0.3, 0.2, 1), 3.4, 0xa78bfa, 0.8, 0.8);
    this.distort(0.4);
    this.ctx.shake(0.45 + 0.2 * h.power, 3);
    this.ctx.pulse(at, { ripple: 0.7, aberr: 0.012 });
  }

  tap(h: Hit, i: number) {
    const at = this.impact();
    this.orb.crack(this.local(), 1.4 + 0.25 * i, 2 + 0.4 * i);
    burst(this.ctx.fx, "cosmic", at, new THREE.Vector3(-1, 0.6, 0), 0.3, h.power * 0.5, STAR);
    this.ctx.fx.ring(CENTER.clone(), new THREE.Vector3(Math.sin(i), 0.3, 1), 2.2 + 0.2 * i, i % 2 ? 0x5ce0d8 : 0xff8fab, 0.5, 0.7);
    this.distort(0.2 + 0.05 * i);
    this.ctx.shake(0.2 + 0.04 * i, 1);
    this.ctx.pulse(at, { ripple: 0.3 });
  }

  /** Looks like a finished level: the shell bursts and the core goes dark. */
  private fakeEnd(h: Hit) {
    const at = this.impact();
    this.stage = "fake";
    this.orb.crack(this.local(), 4, 5);
    this.orb.shatter(this.ctx.fx, at.clone().add(new THREE.Vector3(-0.5, 0, 0)), { speed: 1.6 + h.power, up: 0.1, spin: 1.2, gravity: 0, drag: 1.4 });
    this.core.visible = true;
    this.core.scale.setScalar(0.35);
    this.halo.material.opacity = 0.15;
    for (const r of this.rings) r.visible = false;
    burst(this.ctx.fx, "cosmic", at, new THREE.Vector3(1, 0.3, 0), this.unit, h.power, STAR);
    this.ctx.fx.ring(CENTER.clone(), new THREE.Vector3(0.15, 0.3, 1), 8, 0xc4b5fd, 1.4);
    this.ctx.fx.flash(CENTER.clone(), 0xfffffe, 7, 0.4);
    this.distort(1);
    this.ctx.shake(0.8, 7);
    this.ctx.pulse(at, { flash: 0.35 * h.power, ripple: 1, blur: 0.04, aberr: 0.02 });
  }

  reveal() {
    this.stage = "awake";
    this.core.visible = true;
    this.halo.material.color.set(0xff8fab);
    for (const [i, c] of [0xff8fab, 0x5ce0d8, 0xffd166].entries()) this.after(i * 0.18, () => this.ctx.fx.ring(CENTER.clone(), new THREE.Vector3(Math.cos(i * 2), 0.4, Math.sin(i * 2) + 1), 5 + i * 2, c, 1.1));
    this.ctx.fx.flash(CENTER.clone(), 0xff8fab, 6, 0.6);
    this.distort(1.4);
    this.ctx.shake(0.5, 4);
    this.ctx.pulse(CENTER.clone(), { ripple: 1, aberr: 0.03 });
  }

  finale(h: Hit) {
    const at = this.impact();
    this.stage = "gone";
    this.core.visible = false;
    this.halo.visible = false;
    for (const p of this.orb.pieces) {
      const v = p.position.clone().normalize().multiplyScalar(6 + 6 * h.power);
      this.ctx.fx.throw({ obj: p, v, w: new THREE.Vector3(2, 3, 1), g: 0, drag: 0.1 });
    }
    burst(this.ctx.fx, "cosmic", CENTER.clone(), new THREE.Vector3(1, 0.2, 0), this.unit * 1.6, h.power, STAR);
    burst(this.ctx.fx, "cosmic", at, new THREE.Vector3(1, 0.5, 0), this.unit, h.power, STAR);
    for (const [i, c] of [0xfffffe, 0xa78bfa, 0x5ce0d8, 0xff8fab].entries()) {
      this.ctx.fx.ring(CENTER.clone(), new THREE.Vector3(Math.sin(i * 1.7), Math.cos(i * 1.3), 1), 10 + 6 * i, c, 1.2 + 0.4 * i);
    }
    this.ctx.fx.flash(CENTER.clone(), 0xfffffe, 16, 0.7);
    this.distort(2.4);
    this.ctx.shake(1, 12);
    this.ctx.pulse(at, { flash: 0.6 * h.power + 0.2, color: 0xfff1d6, ripple: 1, blur: 0.08, aberr: 0.035 });
  }

  update(dt: number) {
    super.update(dt);
    this.orb.update(dt);
    const u = (this.sky.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value = this.t;
    this.warp = Math.max(0, this.warp - dt * 0.8);
    u.uWarp.value = this.warp + (this.stage === "awake" ? 0.6 + 0.3 * Math.sin(this.t * 3) : 0);
    this.gal.rotation.y += dt * 0.02;
    for (const r of this.rocks) {
      r.a += dt * r.s;
      r.m.position.set(1.5 + Math.cos(r.a) * r.r, r.y + 0.3 * Math.sin(this.t + r.a), -2 + Math.sin(r.a) * r.r);
      r.m.rotation.x += dt * r.s * 4;
    }
    for (const [i, r] of this.rings.entries()) r.rotation.y += dt * (0.3 + 0.15 * i);
    if (this.stage === "awake") {
      // The shell fragments get drawn into orbit around the waking core.
      this.swell = Math.min(1, this.swell + dt * 1.6);
      this.orb.obj.rotation.y += dt * (0.4 + this.swell * 1.2);
      const pulse = 1 + 0.08 * Math.sin(this.t * 10);
      this.core.scale.setScalar((0.35 + 1.45 * this.swell) * pulse);
      this.halo.scale.setScalar((4 + 6 * this.swell) * pulse);
      this.halo.material.opacity = 0.3 + 0.4 * this.swell;
    } else if (this.stage === "intact") {
      this.halo.scale.setScalar(5 + 0.3 * Math.sin(this.t * 2));
    }
  }
}
