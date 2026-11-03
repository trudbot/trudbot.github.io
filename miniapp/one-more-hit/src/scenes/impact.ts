/*
 * Material-specific destruction bursts, shared by every world. `unit` is
 * the target's rough radius, so the same recipe reads right on a pot and on a
 * planet; `power` (0…1) scales counts and speeds within hard caps.
 */
import * as THREE from "three";
import type { Material } from "../audio/sfx.ts";
import type { Fx } from "../render/fx.ts";

export interface Palette {
  /** Main debris colours. */
  body: THREE.ColorRepresentation[];
  /** Fresh fracture faces. */
  inner?: THREE.ColorRepresentation[];
  dust: THREE.ColorRepresentation[];
  spark?: THREE.ColorRepresentation[];
}

const up = new THREE.Vector3(0, 1, 0);

export function burst(fx: Fx, m: Material, at: THREE.Vector3, dir: THREE.Vector3, unit: number, power: number, pal: Palette, ground = -1e9) {
  const p = Math.min(1, Math.max(0, power));
  const u = unit;
  const g = 9.8 * Math.sqrt(u);
  const inner = pal.inner ?? pal.body;
  const spark = pal.spark ?? [0xfffffe, 0xffd166];
  const n = (a: number, b: number) => Math.round(a + (b - a) * p);
  switch (m) {
    case "ceramic":
      fx.burst("shard", at, n(14, 34), { color: [...pal.body, ...inner], size: 0.22 * u, speed: (3 + 4 * p) * u, dir, cone: 2, gravity: g, ground, spin: 18 });
      fx.burst("glint", at, n(6, 16), { color: 0xfffffe, size: 0.08 * u, speed: (2 + 3 * p) * u, life: 0.6, gravity: g * 0.5, spin: 25 });
      fx.puff(at, n(10, 22), { color: pal.dust, size: 0.5 * u, grow: 2.6, speed: 1.2 * u, life: 1.1, drag: 3, alpha: 0.6, bias: up.clone().multiplyScalar(0.35 * u) });
      fx.spark(at, n(10, 26), { color: spark, size: 0.07 * u, speed: 5 * u, life: 0.35, drag: 3, gravity: g * 0.3 });
      break;
    case "glass":
      fx.burst("glint", at, n(20, 50), { color: [0xfffffe, 0xb5f5ec, 0xa5f3fc], size: 0.1 * u, speed: (3 + 4 * p) * u, dir, cone: 2.2, life: 1.1, gravity: g, ground, spin: 30 });
      fx.burst("shard", at, n(8, 20), { color: pal.body, size: 0.16 * u, speed: (3 + 3 * p) * u, dir, cone: 2, gravity: g, ground, spin: 20 });
      fx.spark(at, n(30, 70), { color: [0xfffffe, 0xb5f5ec, 0xc4b5fd], size: 0.05 * u, speed: 4.5 * u, life: 0.7, drag: 2, gravity: g * 0.2 });
      break;
    case "rock":
      fx.burst("chunk", at, n(10, 28), { color: [...pal.body, ...inner], size: 0.3 * u, speed: (2.5 + 3.5 * p) * u, dir, cone: 1.6, gravity: g, ground, spin: 9, life: 3 });
      fx.puff(at, n(18, 40), { color: pal.dust, size: 0.8 * u, grow: 3, speed: 2 * u, life: 2.2, drag: 2.2, alpha: 0.7, bias: up.clone().multiplyScalar(0.4 * u), radius: 0.3 * u });
      fx.spark(at, n(6, 18), { color: spark, size: 0.06 * u, speed: 6 * u, life: 0.3, drag: 2, gravity: g * 0.4 });
      break;
    case "ice":
      fx.burst("shard", at, n(14, 34), { color: [0xfffffe, 0xb5f5ec, 0x7dd3fc, ...pal.body], size: 0.22 * u, speed: (3 + 4 * p) * u, dir, cone: 2, gravity: g, ground, spin: 16 });
      fx.burst("glint", at, n(10, 26), { color: [0xfffffe, 0xa5f3fc], size: 0.09 * u, speed: (2 + 4 * p) * u, life: 0.9, gravity: g * 0.6 });
      fx.burst("chunk", at, n(4, 12), { color: inner, size: 0.26 * u, speed: (2 + 2 * p) * u, dir, cone: 1.4, gravity: g, ground, spin: 8, life: 3 });
      fx.puff(at, n(24, 50), { color: [0xfffffe, 0xe6f4ff, ...pal.dust], size: 0.9 * u, grow: 3.2, speed: 2.4 * u, life: 2.4, drag: 2, alpha: 0.8, bias: up.clone().multiplyScalar(0.3 * u), radius: 0.4 * u });
      break;
    case "planet":
      fx.burst("chunk", at, n(16, 40), { color: [...pal.body, ...inner], size: 0.22 * u, speed: (2 + 3 * p) * u, dir, cone: 1.9, gravity: 0, spin: 4, life: 5 });
      fx.spark(at, n(40, 90), { color: spark, size: 0.08 * u, speed: 3.5 * u, life: 1.4, drag: 1.2 });
      fx.puff(at, n(16, 34), { color: pal.dust, size: 0.7 * u, grow: 3, speed: 1.2 * u, life: 2.6, drag: 1.4, alpha: 0.55, radius: 0.3 * u });
      break;
    case "cosmic":
      fx.spark(at, n(70, 140), { color: [0xfffffe, 0xa78bfa, 0x5ce0d8, 0xff8fab, 0xffd166], size: 0.09 * u, speed: 4.5 * u, life: 1.8, drag: 1 });
      fx.burst("glint", at, n(20, 50), { color: [0xfffffe, 0xc4b5fd, 0xa5f3fc], size: 0.12 * u, speed: (2.5 + 4 * p) * u, life: 2.4, gravity: 0, spin: 10 });
      fx.burst("chunk", at, n(8, 22), { color: pal.body, size: 0.2 * u, speed: (2 + 3 * p) * u, dir, cone: 2.4, gravity: 0, spin: 5, life: 5 });
      fx.puff(at, n(12, 26), { color: pal.dust, size: 0.9 * u, grow: 3.5, speed: 1.4 * u, life: 2.8, drag: 1.2, alpha: 0.45 });
      break;
  }
}

/** Ground cracks and kicked-up pebbles under the hero while he strains in overcharge. */
export function strain(fx: Fx, feet: THREE.Vector3, dust: THREE.ColorRepresentation, intensity: number) {
  fx.burst("chunk", feet, Math.round(1 + 2 * intensity), { color: dust, size: 0.06, speed: 1.2 + 1.5 * intensity, dir: up, cone: 0.9, gravity: 9.8, ground: feet.y, spin: 12, life: 1.2, radius: 0.35 });
  fx.puff(feet, 1, { color: dust, size: 0.3, grow: 2.4, speed: 0.4, life: 0.9, drag: 3, alpha: 0.45, radius: 0.4, bias: up.clone().multiplyScalar(0.2) });
}
