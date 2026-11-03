/*
 * The courtyard: a tiled yard with a moon gate, blossom tree and lanterns.
 * "pot" plays it in warm afternoon light; "pots" at dusk with the lanterns
 * lit. Close, intimate shots: the target is smaller than the hero.
 */
import * as THREE from "three";
import { clock } from "../clock.ts";
import { sfx } from "../audio/sfx.ts";
import { shot } from "../render/camera.ts";
import { addOutline, toon } from "../render/materials.ts";
import { canvasTex, rng } from "../render/util.ts";
import { Breakable, disc, lights, sky, World, type Hit, type ShotName } from "./common.ts";
import { burst, type Palette } from "./impact.ts";

function tiles(dusk: boolean) {
  const t = canvasTex(512, 512, (c) => {
    const r = rng(11);
    c.fillStyle = dusk ? "#6d6390" : "#d8c3a5";
    c.fillRect(0, 0, 512, 512);
    const s = 64;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const l = (r() - 0.5) * 18;
        c.fillStyle = dusk ? `hsl(252, 18%, ${44 + l * 0.6}%)` : `hsl(33, 34%, ${74 + l * 0.5}%)`;
        c.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

/** Glaze bands follow the lathe's v coordinate, which runs up the profile. */
function glaze(body: string, band: string, lip: string) {
  return canvasTex(8, 256, (c) => {
    c.fillStyle = body;
    c.fillRect(0, 0, 8, 256);
    c.fillStyle = band;
    c.fillRect(0, 80, 8, 46);
    c.fillStyle = lip;
    c.fillRect(0, 70, 8, 6);
    c.fillRect(0, 130, 8, 6);
    c.fillRect(0, 28, 8, 14);
  });
}

export function potGeo(h: number, r: number, neck = 0.55, seg = 20) {
  const prof: [number, number][] = [
    [0.001, 0], [0.55, 0], [0.62, 0.05], [0.92, 0.3], [1, 0.45], [0.86, 0.72], [neck, 0.86], [neck + 0.12, 0.96], [neck + 0.1, 1], [neck - 0.06, 1], [neck - 0.1, 0.8], [0.001, 0.62],
  ];
  return new THREE.LatheGeometry(
    prof.map(([x, y]) => new THREE.Vector2(x * r, y * h)),
    seg,
  );
}

function env(group: THREE.Group, dusk: boolean) {
  group.add(
    sky(
      dusk
        ? { top: 0x2a2350, mid: 0xff8fab, bottom: 0x3a2f5a, sun: 0xffa94d, sunDir: new THREE.Vector3(1, 0.06, -1), sunSize: 3 }
        : { top: 0x7dd3fc, mid: 0xfff1d6, bottom: 0xd8c3a5, sun: 0xffeaa7, sunDir: new THREE.Vector3(0.6, 0.5, -1), sunSize: 2 },
    ),
  );
  const ground = disc(40, { color: 0xffffff, map: tiles(dusk), rim: 0 });
  group.add(ground);
  const wallMat = toon({ color: dusk ? 0xc4b5fd : 0xfff4e0, rim: 0.2 });
  const roofMat = toon({ color: dusk ? 0x3d3a6b : 0x5a6aa8, rim: 0.3, rimColor: 0xffc4d6 });
  for (const [x, z, w, rot] of [[6, -4.5, 14, 0], [-2.5, -5.5, 8, 0.4], [11, 1, 9, Math.PI / 2]] as const) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, 0.4), wallMat);
    wall.position.set(x, 0.9, z);
    wall.rotation.y = rot;
    wall.castShadow = wall.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.22, 0.9), roofMat);
    roof.position.y = 1;
    wall.add(roof);
    addOutline(roof, 0.03);
    group.add(wall);
  }
  const gate = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 10, 40), roofMat);
  gate.position.set(5, 1.25, -4.25);
  group.add(gate);
  // Blossom tree: a few chunky canopy blobs read better than many leaves.
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 8), toon({ color: 0x5a3a2a, rim: 0.2 }));
  trunk.position.set(-1.6, 1.1, -3.2);
  trunk.rotation.z = 0.12;
  trunk.castShadow = true;
  group.add(trunk);
  const leaf = toon({ color: dusk ? 0xff6b9d : 0xffc4d6, rim: 0.5, rimColor: 0xfffffe });
  const r = rng(4);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + r() * 0.35, 1), leaf);
    b.position.set(-1.6 + (r() - 0.5) * 1.8, 2.3 + r() * 0.8, -3.2 + (r() - 0.5) * 1.4);
    b.castShadow = true;
    addOutline(b, 0.03);
    group.add(b);
  }
  const lanternMat = toon({ color: 0xff6b9d, emissive: 0xff6b9d, emissiveIntensity: dusk ? 1.6 : 0.3, rim: 0.3 });
  for (const [x, z] of [[2.5, -3.6], [7.5, -3.6], [-0.5, -4.6]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), lanternMat);
    l.scale.y = 1.25;
    l.position.set(x, 2.25, z);
    addOutline(l, 0.02);
    group.add(l);
    if (dusk) {
      const pl = new THREE.PointLight(0xff8fab, 2.2, 6, 1.6);
      pl.position.copy(l.position);
      group.add(pl);
    }
  }
  return lights(group, dusk
    ? { sky: 0xa78bfa, ground: 0x3a2f5a, hemi: 0.9, key: 0xffa94d, keyI: 2.4, dir: [6, 4, 3], rim: 0x7dd3fc, rimI: 1.4, shadow: 6 }
    : { sky: 0xd6f0ff, ground: 0xd8c3a5, hemi: 1.1, key: 0xfff1d6, keyI: 2.6, dir: [4, 7, 5], rim: 0xffc4d6, rimI: 0.8, shadow: 5 });
}

const CERAMIC: Palette = { body: [0xe07a4f, 0xc8603a, 0x5ce0d8], inner: [0xf2c6a0, 0xe8b48c], dust: [0xe8d3b5, 0xd8c3a5] };

const potShots = (): Record<ShotName, ReturnType<typeof shot>> => ({
  title: shot([3.2, 1.45, 4.6], [0.75, 1.05, 0], 36, 1.6),
  idle: shot([1.2, 1.4, 4.4], [0.85, 0.95, 0], 36, 1.55),
  charge: shot([1.3, 1.2, 3.7], [0.9, 1.1, 0], 38, 1.45),
  over: shot([1.2, 1.0, 3.0], [0.95, 1.15, 0], 40, 1.4),
  final: shot([2.9, 0.45, 2.7], [1.0, 1.0, 0], 46, 1.5, 0.05),
  impact: shot([2.4, 0.7, 2.3], [1.5, 0.5, 0], 42, 1.1),
  result: shot([-0.4, 1.5, 3.8], [0.6, 1.15, 0], 40, 1.5),
  arrive: shot([1.2, 2.6, 7.5], [0.9, 0.9, 0], 40, 2),
});

export class PotWorld extends World {
  readonly id = "pot" as const;
  readonly material = "ceramic" as const;
  readonly scale = 0;
  readonly unit = 0.32;
  readonly face = new THREE.Vector2(1.62, 0.55);
  readonly shots = potShots();
  private pot!: Breakable;

  protected build() {
    env(this.group, false);
    this.background.set(0xfff1d6);
    this.fog = new THREE.Fog(0xfff1d6, 14, 45);
    this.dustColor = 0xd8c3a5;
    this.pot = new Breakable(potGeo(0.55, 0.3), { color: 0xffffff, map: glaze("#e07a4f", "#5ce0d8", "#fffffe"), interior: 0xf2c6a0, crack: 0xffd166, crackScale: 0.09, rim: 0.45, rimColor: 0xffeaa7 }, 16, 21, new THREE.Vector3(0, 0.25, 0), 0.12);
    this.pot.obj.position.set(1.62, 0, 0);
    addOutline(this.pot.intact, 0.012);
    this.group.add(this.pot.obj);
  }

  reset() {
    this.clearTimers();
    this.pot.reset();
  }

  hit(h: Hit) {
    this.pot.crack(new THREE.Vector3(0, 0.55, 0), 0.25 + 0.2 * h.power);
    this.pot.dentAt(new THREE.Vector3(0, 0.55, 0), 0.03, 0.15);
  }

  finale(h: Hit) {
    const at = this.impact();
    this.pot.shatter(this.ctx.fx, at.clone().add(new THREE.Vector3(-0.1, 0.1, 0)), { speed: 3.2 + 2 * h.power, up: 0.8, spin: 14, ground: 0, gravity: 9.8 });
    burst(this.ctx.fx, "ceramic", at, new THREE.Vector3(0.6, 0.6, 0), this.unit, h.power, CERAMIC, 0);
    this.ctx.fx.ring(new THREE.Vector3(at.x, 0.02, 0), new THREE.Vector3(0, 1, 0), 2.2, 0xffeaa7, 0.5);
    this.ctx.fx.decal(new THREE.Vector3(at.x, 0, 0), 1.6, 3);
    this.ctx.fx.flash(at, 0xfffffe, 1.6);
    this.ctx.shake(0.4 + 0.3 * h.power, 4);
    this.ctx.pulse(at, { flash: 0.25 * h.power, ripple: 0.6 + 0.4 * h.power, aberr: 0.01 });
  }

  update(dt: number) {
    super.update(dt);
    this.pot.update(dt);
  }
}

interface Jar {
  b: Breakable;
  glass: boolean;
  wobble: number;
  phase: number;
}

const GLASS: Palette = { body: [0xb5f5ec, 0xa5f3fc, 0xfffffe], dust: [0xe6f4ff] };

/**
 * A crowd of pots and bottles stacked on crates behind a lidded urn. The
 * first hit cracks the urn and knocks over its nearest neighbours; the final
 * hit sends a shatter wave out through the whole array.
 */
export class PotsWorld extends World {
  readonly id = "pots" as const;
  readonly material = "ceramic" as const;
  readonly scale = 0.12;
  readonly unit = 0.4;
  readonly face = new THREE.Vector2(1.72, 0.92);
  readonly shots = {
    ...potShots(),
    idle: shot([1.9, 1.6, 5.4], [1.4, 1.0, 0], 38, 2.1),
    charge: shot([1.7, 1.4, 4.4], [1.2, 1.15, 0], 38, 1.8),
    over: shot([1.4, 1.15, 3.6], [1.1, 1.25, 0], 42, 1.6),
    final: shot([3.6, 0.6, 3.6], [1.6, 1.1, 0], 48, 2.0, 0.06),
    impact: shot([3.2, 1.1, 3.4], [2.2, 0.8, 0], 44, 1.8),
    result: shot([-0.4, 1.6, 4.4], [1.0, 1.1, 0], 42, 2.0),
    arrive: shot([2.5, 3.2, 9], [1.6, 0.9, 0], 40, 2.6),
    title: shot([3.2, 1.45, 4.6], [0.75, 1.05, 0], 36, 1.6),
  };
  private urn!: Breakable;
  private lid!: THREE.Mesh;
  private jars: Jar[] = [];

  protected build() {
    env(this.group, true);
    this.background.set(0x2a2350);
    this.fog = new THREE.Fog(0x3a2f5a, 12, 40);
    this.dustColor = 0x8a7fb0;
    this.urn = new Breakable(
      potGeo(0.92, 0.4, 0.5, 24),
      { color: 0xffffff, map: glaze("#a78bfa", "#ffd166", "#fffffe"), interior: 0xe6dcff, crack: 0xffd166, crackScale: 0.12, rim: 0.5, rimColor: 0xffc4d6 },
      20,
      33,
      new THREE.Vector3(0, 0.45, 0),
      0.12,
    );
    this.urn.obj.position.set(1.72, 0, 0);
    addOutline(this.urn.intact, 0.014);
    this.group.add(this.urn.obj);
    this.lid = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon({ color: 0xffd166, rim: 0.4 }));
    this.lid.scale.y = 0.45;
    this.lid.castShadow = true;
    addOutline(this.lid, 0.012);
    this.group.add(this.lid);

    const crate = toon({ color: 0xb06f3c, rim: 0.25 });
    const r = rng(8);
    const glazes = [["#ff8fab", "#fffffe"], ["#5ce0d8", "#1a1a2e"], ["#ffa94d", "#a78bfa"], ["#7dd3fc", "#ffd166"]];
    let k = 0;
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 5 - row; col++) {
        const x = 2.45 + row * 0.75;
        const z = (col - (4 - row) / 2) * 0.72;
        const lift = row * 0.32;
        if (lift > 0) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, lift, 0.62), crate);
          box.position.set(x, lift / 2, z);
          box.castShadow = box.receiveShadow = true;
          addOutline(box, 0.015);
          this.group.add(box);
        }
        const glass = (k + row) % 4 === 1;
        const h = glass ? 0.5 + r() * 0.15 : 0.36 + r() * 0.2;
        const g = glazes[k++ % glazes.length];
        const b = glass
          ? new Breakable(potGeo(h, 0.15, 0.4, 16), { color: 0x9ef0e6, transparent: true, opacity: 0.72, interior: 0xd8fffa, rim: 0.9, rimColor: 0xfffffe }, 8, 40 + k, new THREE.Vector3(0, h / 2, 0), 0.08)
          : new Breakable(potGeo(h, 0.22 + r() * 0.05), { color: 0xffffff, map: glaze(g[0], g[1], "#fffffe"), interior: 0xf2e0d0, crack: 0xffd166, crackScale: 0.08, rim: 0.4 }, 10, 50 + k, new THREE.Vector3(0, h / 2, 0), 0.12);
        b.obj.position.set(x, lift, z);
        addOutline(b.intact, 0.01);
        this.group.add(b.obj);
        this.jars.push({ b, glass, wobble: 0, phase: r() * 6 });
      }
  }

  reset() {
    this.clearTimers();
    this.urn.reset();
    for (const j of this.jars) {
      j.b.reset();
      j.wobble = 0;
      j.b.intact.rotation.set(0, 0, 0);
    }
    this.lid.position.set(1.72, 0.94, 0);
    this.lid.rotation.set(0, 0, 0);
  }

  private dist(j: Jar) {
    return j.b.obj.position.distanceTo(this.urn.obj.position);
  }

  private breakJar(j: Jar, power: number) {
    if (j.b.broken) return;
    const at = j.b.obj.position.clone().add(new THREE.Vector3(0, 0.25, 0));
    const away = at.clone().sub(this.urn.obj.position).setY(0).normalize().add(new THREE.Vector3(0, 0.8, 0));
    j.b.shatter(this.ctx.fx, at.clone().sub(away.clone().multiplyScalar(0.2)), { speed: 2.5 + 2 * power, up: 0.7, spin: 12, ground: -j.b.obj.position.y });
    burst(this.ctx.fx, j.glass ? "glass" : "ceramic", at, away, 0.22, power, j.glass ? GLASS : CERAMIC, 0);
    sfx.shatter(clock.now(), j.glass ? "glass" : "ceramic", power);
  }

  hit(h: Hit) {
    const at = this.impact();
    this.urn.crack(new THREE.Vector3(0, 0.9, 0), 0.5 + 0.3 * h.power);
    this.urn.dentAt(new THREE.Vector3(0, 0.92, 0), 0.05, 0.2);
    // The lid pops off and the two nearest jars topple: a taste of the chain.
    this.ctx.fx.throw({ obj: this.lid, v: new THREE.Vector3(1.5, 4.5, 1.2), w: new THREE.Vector3(5, 2, 9), g: 9.8, drag: 0.2, ground: 0.05 });
    const near = [...this.jars].sort((a, b) => this.dist(a) - this.dist(b)).slice(0, 2);
    near.forEach((j, i) => this.after(0.08 + i * 0.07, () => this.breakJar(j, 0.5)));
    for (const j of this.jars) j.wobble = Math.max(j.wobble, 0.25 / (1 + this.dist(j)));
    burst(this.ctx.fx, "ceramic", at, new THREE.Vector3(0.3, 1, 0), 0.25, h.power * 0.6, CERAMIC, 0);
    this.ctx.fx.ring(new THREE.Vector3(at.x, 0.02, 0), new THREE.Vector3(0, 1, 0), 1.6, 0xffd166, 0.45, 0.7);
    this.ctx.shake(0.3 + 0.2 * h.power, 2);
    this.ctx.pulse(at, { ripple: 0.4 + 0.3 * h.power });
  }

  tap(h: Hit, i: number) {
    this.hit({ ...h, power: h.power * 0.4 });
    void i;
  }

  finale(h: Hit) {
    const at = this.impact();
    this.urn.shatter(this.ctx.fx, at.clone().add(new THREE.Vector3(-0.15, 0.1, 0)), { speed: 3.5 + 2.5 * h.power, up: 0.7, spin: 14, ground: 0 });
    burst(this.ctx.fx, "ceramic", at, new THREE.Vector3(0.7, 0.6, 0), 0.45, h.power, CERAMIC, 0);
    this.ctx.fx.ring(new THREE.Vector3(at.x, 0.03, 0), new THREE.Vector3(0, 1, 0), 5, 0xffeaa7, 0.7);
    this.ctx.fx.decal(new THREE.Vector3(at.x, 0, 0), 2.4, 7, "rgba(26,26,46,0.85)");
    this.ctx.fx.flash(at, 0xfffffe, 2.4);
    // Shatter wave: jars go in order of distance, so the chain reads as a ripple.
    for (const j of this.jars) this.after(0.05 + this.dist(j) * 0.11, () => this.breakJar(j, 0.6 + 0.4 * h.power));
    this.ctx.shake(0.5 + 0.3 * h.power, 5);
    this.ctx.pulse(at, { flash: 0.3 * h.power, ripple: 0.8 + 0.4 * h.power, aberr: 0.012 });
  }

  update(dt: number) {
    super.update(dt);
    this.urn.update(dt);
    for (const j of this.jars) {
      j.b.update(dt);
      if (j.wobble > 0.001 && !j.b.broken) {
        j.wobble *= Math.exp(-2.5 * dt);
        j.b.intact.rotation.z = Math.sin(this.t * 18 + j.phase) * j.wobble;
        j.b.intact.rotation.x = Math.cos(this.t * 15 + j.phase) * j.wobble * 0.6;
      }
    }
  }
}
