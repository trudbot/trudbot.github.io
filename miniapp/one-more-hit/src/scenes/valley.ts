/*
 * A miniature snowy valley seen from a giant's height: pines, a frozen
 * river and one jagged peak. Rhythm taps shake avalanches loose; the
 * finale opens a rift and the mountain collapses into ice and rock.
 */
import * as THREE from "three";
import { shot } from "../render/camera.ts";
import { addOutline, toon } from "../render/materials.ts";
import { displace, fbm, rng } from "../render/util.ts";
import { Breakable, disc, lights, sky, stars, World, type Hit } from "./common.ts";
import { burst, type Palette } from "./impact.ts";

const ICE: Palette = { body: [0x8ea3c7, 0x6b7fa8, 0xfffffe], inner: [0xb5f5ec, 0x7dd3fc], dust: [0xfffffe, 0xe6f4ff, 0xc9d6f0] };

function peakGeo(seed: number) {
  const g = new THREE.ConeGeometry(1.7, 2.9, 28, 14);
  g.translate(0, 1.45, 0);
  return displace(g, (p) => {
    const h = p.y / 2.9;
    return (0.22 * fbm(p.x * 1.4 + seed, p.y * 1.4, p.z * 1.4, 4) + 0.08 * Math.abs(fbm(p.x * 4, p.y * 4 + seed, p.z * 4, 2))) * (1 - h * 0.6);
  });
}

/** Snow above a wavy line, rock below; baked into vertex colours. */
function paint(geo: THREE.BufferGeometry, snowLine: number) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const snow = new THREE.Color(0xf4f8ff), rock = new THREE.Color(0x5a6385), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const line = snowLine + 0.25 * fbm(x * 2, 0, z * 2, 2);
    c.copy(y > line ? snow : rock);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

export class ValleyWorld extends World {
  readonly id = "mountain" as const;
  readonly material = "ice" as const;
  readonly scale = 0.5;
  readonly unit = 1.1;
  readonly face = new THREE.Vector2(1.95, 1.05);
  readonly shots = {
    title: shot([3.2, 1.45, 4.6], [0.75, 1.05, 0], 36, 2),
    idle: shot([0.2, 2.3, 7.2], [1.9, 1.3, 0], 40, 3),
    charge: shot([0.4, 1.6, 5.6], [1.6, 1.4, 0], 42, 2.4),
    over: shot([-0.5, 1.0, 4.4], [1.3, 1.5, 0], 46, 2.1),
    final: shot([-2.6, 0.5, 5], [2.2, 1.7, 0], 52, 3, -0.06),
    impact: shot([2.2, 4.5, 13], [3, 1, 0], 44, 5),
    result: shot([-0.8, 2.4, 7], [1.6, 1.3, 0], 42, 3),
    arrive: shot([2.5, 9, 24], [2, 1, 0], 42, 6),
  };
  private peak!: Breakable;
  private snowCap!: THREE.Mesh;
  private pines: THREE.Object3D[] = [];
  private tapCount = 0;
  private flakes!: THREE.Points;

  protected build() {
    const g = this.group;
    g.add(sky({ top: 0x2b2d55, mid: 0x818cf8, bottom: 0xc4b5fd, sun: 0xffc4d6, sunDir: new THREE.Vector3(1, 0.2, -1), sunSize: 2 }));
    g.add(stars(600, 1400, 3, 1.8));
    this.background.set(0x818cf8);
    this.fog = new THREE.Fog(0xa3a8e8, 14, 60);
    this.dustColor = 0xe6f4ff;
    g.add(disc(90, { color: 0xeaf0ff, rim: 0.1 }));
    const r = rng(23);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 60).rotateX(-Math.PI / 2), toon({ color: 0x7dd3fc, emissive: 0x2a6fa8, emissiveIntensity: 0.3, rim: 0.8 }));
    river.position.set(4.4, 0.01, 0);
    river.rotation.y = 0.35;
    river.receiveShadow = true;
    g.add(river);
    // Far range: same geometry family, pushed into the fog for depth.
    for (const [x, z, s] of [[9, -10, 2.4], [-4, -14, 3], [16, -4, 2], [4, -22, 4], [20, -18, 3.5], [-12, -6, 1.8]] as const) {
      const m = new THREE.Mesh(paint(peakGeo(x), 1.6), toon({ color: 0xffffff, vertexColors: true, rim: 0.4, rimColor: 0xffc4d6 }));
      m.scale.setScalar(s);
      m.position.set(x, 0, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    const pine = toon({ color: 0x2f7a6a, rim: 0.4, rimColor: 0x7dffc7 });
    const pineGeo = new THREE.ConeGeometry(0.09, 0.32, 7);
    pineGeo.translate(0, 0.16, 0);
    for (let i = 0; i < 70; i++) {
      const x = -2 + r() * 10, z = -5 + r() * 10;
      if (Math.abs(z) < 1 && x < 4.6 && x > -1) continue;
      const p = new THREE.Mesh(pineGeo, pine);
      p.position.set(x, 0, z);
      p.scale.setScalar(0.7 + r() * 0.8);
      p.castShadow = true;
      g.add(p);
      this.pines.push(p);
    }
    // Tiny cabins sell the giant's scale.
    const cabin = toon({ color: 0xffa94d, rim: 0.3 });
    const roof = toon({ color: 0xff6b9d, rim: 0.3 });
    for (const [x, z] of [[5.2, 1.6], [5.6, 2.1], [3.6, -2.6]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), cabin);
      b.position.set(x, 0.05, z);
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.09, 4), roof);
      t.position.y = 0.09;
      t.rotation.y = Math.PI / 4;
      b.add(t);
      b.castShadow = true;
      g.add(b);
    }
    lights(g, { sky: 0xc4b5fd, ground: 0x6b7fa8, hemi: 1.0, key: 0xffe0f0, keyI: 2.6, dir: [5, 7, 5], rim: 0x7dd3fc, rimI: 1.6, shadow: 7, center: new THREE.Vector3(2, 0, 0) });

    const geo = paint(peakGeo(1), 1.5);
    this.peak = new Breakable(geo, { color: 0xffffff, vertexColors: true, interior: 0x7dd3fc, crack: 0x7dd3fc, crackScale: 0.45, rim: 0.5, rimColor: 0xffffff }, 13, 5, new THREE.Vector3(0, 1.0, 0), 0.7);
    this.peak.obj.position.set(3.1, 0, 0);
    addOutline(this.peak.intact, 0.02);
    this.group.add(this.peak.obj);
    this.snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 16), toon({ color: 0xfffffe, rim: 0.6 }));
    this.snowCap.castShadow = true;
    this.group.add(this.snowCap);

    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([-4 + r() * 14, r() * 8, -6 + r() * 12], i * 3);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.flakes = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.85, depthWrite: false }));
    g.add(this.flakes);
  }

  reset() {
    this.clearTimers();
    this.peak.reset();
    this.tapCount = 0;
    this.snowCap.visible = true;
    this.snowCap.position.set(3.1, 2.62, 0);
    this.snowCap.rotation.set(0, 0, 0);
    for (const p of this.pines) p.rotation.set(0, 0, 0);
  }

  private local() {
    return this.peak.obj.worldToLocal(this.impact());
  }

  private avalanche(power: number) {
    const top = new THREE.Vector3(3.1, 2.2, 0);
    this.ctx.fx.puff(top, Math.round(10 + 14 * power), { color: ICE.dust, size: 0.5, grow: 3, speed: 1.5, life: 2.2, drag: 1.5, alpha: 0.8, dir: new THREE.Vector3(-0.5, -0.6, 0.3), cone: 1.8, radius: 0.6, gravity: 0.5 });
  }

  hit(h: Hit) {
    const at = this.impact();
    this.peak.crack(this.local(), 0.9 + 0.5 * h.power, 2);
    this.peak.dentAt(this.local(), 0.08, 0.4);
    burst(this.ctx.fx, "ice", at, new THREE.Vector3(-0.5, 1, 0), 0.5, h.power * 0.7, ICE, 0);
    this.avalanche(h.power);
    this.ctx.fx.ring(new THREE.Vector3(at.x, 0.03, 0), new THREE.Vector3(0, 1, 0), 4, 0xb5f5ec, 0.6, 0.7);
    this.ctx.shake(0.4 + 0.2 * h.power, 3);
    this.ctx.pulse(at, { ripple: 0.6, aberr: 0.008 });
    for (const p of this.pines) p.rotation.z = 0.15 * h.power * (Math.random() - 0.5);
  }

  tap(h: Hit, i: number) {
    this.tapCount++;
    const at = this.impact();
    this.peak.crack(this.local(), 1.2 + 0.25 * this.tapCount, 1.5 + 0.4 * this.tapCount);
    burst(this.ctx.fx, "ice", at, new THREE.Vector3(-0.6, 1, 0), 0.3, h.power * 0.5, ICE, 0);
    if (i % 2 === 1) this.avalanche(0.5);
    this.ctx.shake(0.2 + 0.05 * i, 1);
    this.ctx.pulse(at, { ripple: 0.3 });
  }

  finale(h: Hit) {
    const at = this.impact();
    this.peak.crack(this.local(), 5, 5);
    // Rift: the split propagates up and away from the impact before pieces fly.
    this.ctx.fx.decal(new THREE.Vector3(2.4, 0, 0), 7, 31, "rgba(30,40,90,0.9)");
    this.after(0.08, () => {
      this.peak.shatter(this.ctx.fx, at.clone().add(new THREE.Vector3(-0.6, 0.2, 0)), { speed: 3 + 2 * h.power, up: 0.4, spin: 2.5, ground: 0, gravity: 9, stagger: 0.05, reach: 4 });
      this.snowCap.visible = false;
    });
    burst(this.ctx.fx, "ice", at, new THREE.Vector3(0.7, 0.8, 0), this.unit, h.power, ICE, 0);
    this.ctx.fx.puff(new THREE.Vector3(3.1, 0.4, 0), 50, { color: ICE.dust, size: 1.6, grow: 3, speed: 4.5, life: 3.2, drag: 1.3, alpha: 0.75, dir: new THREE.Vector3(0, 0.3, 0), cone: 3, radius: 1.4 });
    this.ctx.fx.ring(new THREE.Vector3(3.1, 0.05, 0), new THREE.Vector3(0, 1, 0), 16, 0xb5f5ec, 1.1);
    this.ctx.fx.flash(at, 0xe6f4ff, 6);
    this.ctx.shake(0.85, 8);
    this.ctx.pulse(at, { flash: 0.35 * h.power, ripple: 1, blur: 0.05, aberr: 0.018 });
    for (const p of this.pines) {
      const d = p.position.distanceTo(this.peak.obj.position);
      this.after(d * 0.06, () => (p.rotation.z = -0.5 / (0.6 + d * 0.3)));
    }
    this.after(0.7, () => this.ctx.shake(0.4));
  }

  update(dt: number) {
    super.update(dt);
    this.peak.update(dt);
    const pos = this.flakes.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 0.35;
      if (y < 0) y += 8;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(this.t + i) * dt * 0.1);
    }
    pos.needsUpdate = true;
  }
}
