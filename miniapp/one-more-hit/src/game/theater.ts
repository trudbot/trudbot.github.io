/*
 * Everything on screen that is not gameplay rules: scene graph, camera,
 * post effects, hit stop and world swapping. The director tells it what
 * happens; it decides how that looks.
 */
import * as THREE from "three";
import { Hero } from "../hero/rig.ts";
import { CameraRig, type Shot } from "../render/camera.ts";
import { Fx } from "../render/fx.ts";
import { Renderer } from "../render/post.ts";
import { damp } from "../render/util.ts";
import type { Ctx, ShotName, World } from "../scenes/common.ts";
import { WORLDS } from "../scenes/index.ts";
import { strain } from "../scenes/impact.ts";
import type { SceneId } from "./config.ts";

/** Animation speed during hit stop: near-frozen, so the hammer visibly sticks in. */
const STOP_SCALE = 0.04;

export class Theater {
  readonly scene = new THREE.Scene();
  readonly renderer: Renderer;
  readonly rig = new CameraRig();
  readonly fx = new Fx();
  readonly hero = new Hero();
  readonly ctx: Ctx;
  world!: World;
  private worlds = new Map<SceneId | "ending", World>();
  private stopLeft = 0;
  private flash = 0;
  private veil = 0;
  private veilTo = 0;
  private veilRate = 4;
  private blur = 0;
  private aberr = 0;
  private desatTo = 0;
  private strainT = 0;
  /** Overcharge strain 0…1; feeds pebbles at the hero's feet. */
  strain = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.scene.add(this.hero.obj, this.hero.trail.obj, this.fx.root);
    this.ctx = {
      fx: this.fx,
      hero: this.hero,
      shake: (amount, fov = 0) => {
        this.rig.shake(amount);
        if (fov) this.rig.punch(fov);
      },
      pulse: (at, o) => this.pulse(at, o),
    };
  }

  /** Builds a world on first use; construction is the slow part, so callers can warm it ahead. */
  get(id: SceneId | "ending") {
    let w = this.worlds.get(id);
    if (!w) {
      w = WORLDS[id]();
      w.init(this.ctx);
      this.worlds.set(id, w);
    }
    return w;
  }

  use(id: SceneId | "ending") {
    const w = this.get(id);
    if (this.world && this.world !== w) {
      this.world.exit();
      this.scene.remove(this.world.group);
    }
    this.world = w;
    this.scene.add(w.group);
    this.scene.background = w.background;
    this.scene.fog = w.fog;
    this.rig.setShakeScale(w.shakeScale);
    this.hero.obj.position.copy(w.heroAt);
    this.hero.aimAt(w.face);
    this.hero.obj.visible = id !== "ending";
    this.restage();
    w.enter();
    return w;
  }

  /** Back to a clean, intact stage: on entering a level and on retry. */
  restage() {
    this.fx.clear();
    this.world.reset();
    this.hero.reset();
    this.stopLeft = 0;
    this.flash = 0;
    this.blur = 0;
    this.aberr = 0;
    this.desatTo = 0;
    this.strain = 0;
    this.renderer.u.uDesat.value = 0;
    this.renderer.u.uRipple.value.w = 0;
  }

  shot(name: ShotName, rate = 3) {
    this.rig.go(this.world.shots[name], rate);
  }

  cut(name: ShotName | Shot) {
    this.rig.cut(typeof name === "string" ? this.world.shots[name] : name);
  }

  /** Freezes animation for `sec` of game time; music keeps playing. */
  hitStop(sec: number) {
    this.stopLeft = Math.max(this.stopLeft, sec);
  }

  pulse(at: THREE.Vector3, o: { flash?: number; color?: THREE.ColorRepresentation; ripple?: number; blur?: number; aberr?: number }) {
    const u = this.renderer.u;
    if (o.flash) {
      this.flash = Math.max(this.flash, Math.min(0.7, o.flash));
      u.uFlash.value.set(o.color ?? 0xffffff);
    }
    if (o.ripple) {
      const uv = this.renderer.toUv(at, this.rig.cam);
      u.uRipple.value.set(uv.x, uv.y, 0, Math.min(1, o.ripple));
    }
    if (o.blur) this.blur = Math.max(this.blur, Math.min(0.1, o.blur));
    if (o.aberr) this.aberr = Math.max(this.aberr, Math.min(0.04, o.aberr));
  }

  /** Full-screen colour wash used to hide world swaps. */
  fade(to: number, rate = 4, color: THREE.ColorRepresentation = 0xfffffe) {
    this.veilTo = to;
    this.veilRate = rate;
    if (to > 0) this.renderer.u.uFlash.value.set(color);
  }

  desaturate(x: number) {
    this.desatTo = x;
  }

  resize(w: number, h: number) {
    this.renderer.resize(w, h);
    this.rig.aspect = this.renderer.aspect;
  }

  frame(dt: number) {
    // Hit stop slows the world, not the clock: judgement and music stay on time.
    let a = dt;
    if (this.stopLeft > 0) {
      const frozen = Math.min(dt, this.stopLeft);
      this.stopLeft -= frozen;
      a = frozen * STOP_SCALE + (dt - frozen);
    }
    this.hero.update(a);
    this.world.update(a);
    this.fx.update(a);
    this.rig.update(a);
    if (this.strain > 0.35) {
      this.strainT -= a;
      if (this.strainT <= 0) {
        this.strainT = 0.14 - 0.08 * this.strain;
        const feet = this.world.heroAt.clone().add(new THREE.Vector3(0.1, this.world.ground + 0.02, 0));
        strain(this.fx, feet, this.world.dustColor, this.strain);
      }
    }

    const u = this.renderer.u;
    this.flash *= Math.exp(-a * 5);
    this.veil = damp(this.veil, this.veilTo, this.veilRate, dt);
    u.uFlashAmt.value = Math.max(this.flash, this.veil);
    const rp = u.uRipple.value;
    if (rp.w > 0) {
      rp.z += a;
      if (rp.z > 1.6) rp.w = 0;
    }
    this.blur = damp(this.blur, 0, 4, a);
    this.aberr = damp(this.aberr, 0, 3, a);
    u.uBlur.value = this.blur;
    u.uAberr.value = 0.0015 + this.aberr;
    u.uDesat.value = damp(u.uDesat.value, this.desatTo, 3, dt);
    const r = this.renderer;
    if (r.shatterT !== null) {
      r.shatterT += dt;
      if (r.shatterT > 3.5) r.clearShatter();
    }
    this.fx.setViewport(r.gl.domElement.height, this.rig.cam.fov);
    r.render(this.scene, this.rig.cam);
  }
}
