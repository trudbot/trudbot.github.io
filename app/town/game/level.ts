import * as THREE from "three";
import { Particles } from "./particles";
import { geo, mesh, toon } from "./toon";

interface ColliderFlags {
  /**
   * Floating platform: only a floor, and only while the character is falling onto
   * it. It never pushes sideways, so the character can jump up through it from
   * below and walk underneath it on the ground.
   */
  oneWay?: boolean;
  /** Temporarily ignored (e.g. a crumbled platform waiting to respawn). */
  off?: boolean;
  /** How far the platform moved during the last update; a character standing on it moves along. */
  carry?: { x: number; y: number; z: number };
  /** Called every frame the character stands on this collider. */
  onStand?: () => void;
}

/** Axis-aligned footprint in the XZ plane, solid from the ground up to `top`. */
export interface BoxCollider extends ColliderFlags {
  kind: "box";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number;
}

export interface CircleCollider extends ColliderFlags {
  kind: "circle";
  x: number;
  z: number;
  r: number;
  top: number;
}

export type Collider = BoxCollider | CircleCollider;

/** Height that is never reachable by jumping; used for walls and trees. */
export const SOLID = 100;

export interface Interactable {
  label: string;
  radius: number;
  pos: () => { x: number; z: number };
  action: () => void;
  /** Interactables whose content depends on state (e.g. day/night) can relabel themselves. */
  dynamicLabel?: () => string;
  /** Vertical reach; interactables without it only trigger near the ground. */
  y?: number;
}

export interface StarPickup {
  id: string;
  object: THREE.Object3D;
  collected: boolean;
  baseY: number;
}

export interface Cutaway {
  wall: THREE.Object3D;
  decor: THREE.Object3D;
  /** Outward normal of the wall (XZ). */
  nx: number;
  nz: number;
  /** A point on the wall plane (XZ). */
  px: number;
  pz: number;
}

export interface CameraRig {
  distance: number;
  minDistance: number;
  maxDistance: number;
  pitch: number;
  yaw: number;
}

export interface LevelOptions {
  id: string;
  name: string;
  indoor: boolean;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawn: { x: number; z: number; facing: number };
  camera: CameraRig;
}

export class Level {
  readonly scene = new THREE.Scene();
  readonly colliders: Collider[] = [];
  readonly interactables: Interactable[] = [];
  readonly stars: StarPickup[] = [];
  readonly cutaways: Cutaway[] = [];
  readonly cameraBlockers: THREE.Object3D[] = [];
  readonly updaters: Array<(dt: number, t: number) => void> = [];
  readonly nightHandlers: Array<(k: number) => void> = [];
  readonly fx = new Particles(900);
  readonly glow = new Particles(500, THREE.AdditiveBlending);
  /** Shadow-casting light; the engine keeps it (and its shadow frustum) centred on the player. */
  sun: THREE.DirectionalLight | null = null;
  readonly sunOffset = new THREE.Vector3(16, 28, 10);

  constructor(readonly opts: LevelOptions) {
    this.scene.add(this.fx.points, this.glow.points);
  }

  get id() {
    return this.opts.id;
  }

  box(cx: number, cz: number, w: number, d: number, top = SOLID) {
    const c: BoxCollider = {
      kind: "box",
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      top,
    };
    this.colliders.push(c);
    return c;
  }

  circle(x: number, z: number, r: number, top = SOLID) {
    const c: CircleCollider = { kind: "circle", x, z, r, top };
    this.colliders.push(c);
    return c;
  }

  /**
   * Registers a collider from an object's world-space bounding box. Only exact
   * for objects rotated by multiples of 90° around Y, which is how the town is laid out.
   */
  colliderFrom(obj: THREE.Object3D, top?: number, shrink = 0) {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj);
    this.colliders.push({
      kind: "box",
      minX: b.min.x + shrink,
      maxX: b.max.x - shrink,
      minZ: b.min.z + shrink,
      maxZ: b.max.z - shrink,
      top: top ?? b.max.y,
    });
  }

  addStar(id: string, x: number, y: number, z: number) {
    const star = createStarMesh();
    star.position.set(x, y, z);
    this.scene.add(star);
    this.stars.push({ id, object: star, collected: false, baseY: y });
  }

  interact(label: string, x: number, z: number, radius: number, action: () => void, dynamicLabel?: () => string) {
    this.interactables.push({ label, radius, pos: () => ({ x, z }), action, dynamicLabel });
  }

  update(dt: number, t: number) {
    for (const star of this.stars) {
      if (star.collected) continue;
      star.object.rotation.y = t * 2;
      star.object.position.y = star.baseY + Math.sin(t * 2.5 + star.baseY) * 0.12;
      if (Math.random() < dt * 3) {
        this.glow.emit({
          pos: star.object.position,
          spread: 0.7,
          colors: ["#FFD166", "#FFEAA7"],
          size: 0.18,
          life: 0.8,
          vel: [0, 0.4, 0],
          sprite: 0,
        });
      }
    }
    for (const fn of this.updaters) fn(dt, t);
    this.fx.update(dt);
    this.glow.update(dt);
  }

  setNight(k: number) {
    for (const fn of this.nightHandlers) fn(k);
  }
}

let starGeometry: THREE.ExtrudeGeometry | null = null;

function createStarMesh() {
  if (!starGeometry) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.42 : 0.2;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    starGeometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    starGeometry.center();
  }
  const star = mesh(starGeometry, toon("#FFD166", { emissive: "#FFA94D", emissiveIntensity: 0.45 }), {
    receive: false,
  });
  const halo = mesh(geo.sphere(0.55, 16, 10), toon("#FFEAA7", { transparent: true, opacity: 0.18, outline: false }), {
    cast: false,
    receive: false,
  });
  const g = new THREE.Group();
  g.add(star, halo);
  return g;
}

// ─── Collision ──────────────────────────────────────────────────────────────

/** Tallest ledge the character walks onto without jumping. */
export const STEP_HEIGHT = 0.36;

export interface CollisionResult {
  ground: number;
  /** The collider providing `ground`, or null for the terrain. */
  on: Collider | null;
}

/**
 * Pushes a circle (the character) out of every collider it cannot stand on and
 * returns the ground height under it. A collider counts as a floor when the
 * character was already above its top minus a step, which lets it walk up small
 * steps and land on crates, benches and mushrooms after a jump.
 */
export function resolveCollisions(p: THREE.Vector3, prevY: number, radius: number, colliders: Collider[], falling: boolean, out: CollisionResult) {
  for (let pass = 0; pass < 2; pass++) {
    out.ground = 0;
    out.on = null;
    for (const c of colliders) {
      if (c.off) continue;
      const standable = prevY >= c.top - STEP_HEIGHT;
      if (c.oneWay && (!standable || !falling)) continue;
      if (c.kind === "box") {
        const qx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const qz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - qx;
        const dz = p.z - qz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (standable) {
          if (d2 < radius * radius * 0.36 && c.top > out.ground) {
            out.ground = c.top;
            out.on = c;
          }
          continue;
        }
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (radius - d);
          p.z += (dz / d) * (radius - d);
        } else {
          const left = p.x - c.minX;
          const right = c.maxX - p.x;
          const back = p.z - c.minZ;
          const front = c.maxZ - p.z;
          const m = Math.min(left, right, back, front);
          if (m === left) p.x = c.minX - radius;
          else if (m === right) p.x = c.maxX + radius;
          else if (m === back) p.z = c.minZ - radius;
          else p.z = c.maxZ + radius;
        }
      } else {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const d2 = dx * dx + dz * dz;
        const rr = c.r + radius;
        if (d2 >= rr * rr) continue;
        if (standable) {
          if (d2 < (c.r + radius * 0.4) ** 2 && c.top > out.ground) {
            out.ground = c.top;
            out.on = c;
          }
          continue;
        }
        const d = Math.sqrt(d2) || 1e-4;
        p.x = c.x + (dx / d) * rr;
        p.z = c.z + (dz / d) * rr;
      }
    }
  }
  return out;
}
