/*
 * Camera rig. Shots are authored for a 16:9 frame; `fit` names the half-width
 * that must stay on screen, and narrower (portrait) screens pull the camera
 * back along the shot axis until it does. Moves are spring-damped toward the
 * active shot; shake and FOV kicks are layered on top and never accumulate
 * into the base pose.
 */
import * as THREE from "three";
import { damp, noise3 } from "./util.ts";

export interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  /** Half-width around `look` that must remain visible. */
  fit?: number;
  roll?: number;
}

export const shot = (pos: [number, number, number], look: [number, number, number], fov = 40, fit?: number, roll = 0): Shot => ({
  pos: new THREE.Vector3(...pos),
  look: new THREE.Vector3(...look),
  fov,
  fit,
  roll,
});

export class CameraRig {
  readonly cam = new THREE.PerspectiveCamera(40, 1, 0.05, 4000);
  private pos = new THREE.Vector3(0, 2, 8);
  private look = new THREE.Vector3();
  private fov = 40;
  private roll = 0;
  private target: Shot = shot([0, 2, 8], [0, 1, 0]);
  /** Approach rate, 1/s; higher is snappier. */
  private rate = 3;
  private trauma = 0;
  private shakeAmp = 1;
  private kick = 0;
  private t = 0;
  aspect = 16 / 9;

  setShakeScale(a: number) {
    this.shakeAmp = a;
  }

  /** Moves toward a shot; `rate` sets how quickly. */
  go(s: Shot, rate = 3) {
    this.target = s;
    this.rate = rate;
  }

  cut(s: Shot) {
    this.target = s;
    const f = this.framed(s);
    this.pos.copy(f.pos);
    this.look.copy(s.look);
    this.fov = s.fov;
    this.roll = s.roll ?? 0;
  }

  /** Adds trauma (0…1); shake grows with its square so small hits stay subtle. */
  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Momentary FOV punch in degrees; positive widens. */
  punch(deg: number) {
    this.kick += deg;
  }

  private framed(s: Shot) {
    const pos = s.pos.clone();
    if (s.fit !== undefined) {
      const off = pos.clone().sub(s.look);
      const dist = off.length();
      const half = Math.tan(THREE.MathUtils.degToRad(s.fov) / 2);
      const need = s.fit / (half * Math.min(this.aspect, 16 / 9));
      if (need > dist) pos.copy(s.look).addScaledVector(off, need / dist);
    }
    return { pos };
  }

  update(dt: number) {
    this.t += dt;
    const f = this.framed(this.target);
    const k = this.rate;
    this.pos.set(damp(this.pos.x, f.pos.x, k, dt), damp(this.pos.y, f.pos.y, k, dt), damp(this.pos.z, f.pos.z, k, dt));
    this.look.set(
      damp(this.look.x, this.target.look.x, k * 1.2, dt),
      damp(this.look.y, this.target.look.y, k * 1.2, dt),
      damp(this.look.z, this.target.look.z, k * 1.2, dt),
    );
    this.fov = damp(this.fov, this.target.fov, k, dt);
    this.roll = damp(this.roll, this.target.roll ?? 0, k, dt);
    this.kick = damp(this.kick, 0, 7, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);

    const cam = this.cam;
    cam.position.copy(this.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.look);
    const s = this.trauma * this.trauma * this.shakeAmp;
    if (s > 1e-4) {
      // Noise instead of white jitter: shake reads as a heavy, rolling jolt.
      const n = this.t * 22;
      const dist = this.pos.distanceTo(this.look);
      cam.translateX(noise3(n, 0, 0) * s * 0.05 * dist);
      cam.translateY(noise3(0, n, 0) * s * 0.05 * dist);
      cam.rotateZ(noise3(0, 0, n) * s * 0.06);
    }
    cam.rotateZ(this.roll);
    cam.fov = this.fov + this.kick;
    cam.aspect = this.aspect;
    cam.updateProjectionMatrix();
  }
}
