import * as THREE from "three";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { trackClick, trackDisplay } from "@/lib/analytics";
import { GameAudio } from "./audio";
import { createCharacter, type Character } from "./character";
import { HOUSES, type GameContext, type HouseId } from "./context";
import { Input } from "./input";
import { buildInterior } from "./interiors";
import { resolveCollisions, type Collider, type CollisionResult, type Interactable, type Level, type StarPickup } from "./level";
import { Sprite } from "./particles";
import { geo, group, mesh, toon } from "./toon";
import { buildTown, type Town } from "./town";
import type { ActionKey, GameCallbacks, HudState } from "./types";

const GRAVITY = 22;
const JUMP_SPEED = 8;
const WALK = 4.2;
const RUN = 7.4;
const RADIUS = 0.36;
const FOV = 50;
const MAP_RANGE = 60;
const ORIGIN = new THREE.Vector3();

/** Decimetres are plenty to tell where something happened and keep payloads small. */
const roundPos = (p: THREE.Vector3) => [p.x, p.y, p.z].map((n) => Math.round(n * 10) / 10);

const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export class TownGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly effect: OutlineEffect;
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 900);
  private readonly clock = new THREE.Clock();
  private readonly audio = new GameAudio();
  private readonly input: Input;
  private readonly ctx: GameContext;
  private readonly town: Town;
  private readonly interiors = new Map<HouseId, Level>();
  private readonly character: Character;
  private readonly raycaster = new THREE.Raycaster();
  private level: Level;

  private readonly player = new THREE.Vector3();
  private readonly vel = new THREE.Vector2();
  private vy = 0;
  private grounded = true;
  private standing: Collider | null = null;
  private readonly hit: CollisionResult = { ground: 0, on: null };
  private coyote = 0;
  private jumpBuffer = 0;
  private facing = Math.PI;
  private scale = 1;
  private lastStepPhase = 0;

  private yaw = 0;
  private pitch = 0.42;
  private distance = 9;
  private camDistance = 9;
  private readonly camTarget = new THREE.Vector3();
  private readonly camDir = new THREE.Vector3();

  private time = 0;
  private startedAt = -1;
  private transitioning = false;
  private savedYaw = 0;
  private night = false;
  private nightK = 0;
  private boostT = 0;
  private growT = 0;
  private danceT = 0;
  private waveT = 0;
  private emoteTime = 0;
  private flower: THREE.Object3D | null = null;
  private dialog: { title: string; pages: string[]; page: number } | null = null;
  private prompt: Interactable | null = null;
  private promptLabel: string | null = null;
  private readonly totalStars: number;
  private collected = 0;
  private readonly hud: HudState;

  private readonly minimap: HTMLCanvasElement | null;
  private minimapBase: HTMLCanvasElement | null = null;
  private minimapClock = 0;
  private viewportScale = 400;
  private raf = 0;
  private disposed = false;
  private sessionReported = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    minimap: HTMLCanvasElement | null,
    private readonly cb: GameCallbacks,
  ) {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.effect = new OutlineEffect(this.renderer, {
      defaultThickness: 0.0032,
      defaultColor: [0.11, 0.09, 0.16],
      defaultAlpha: 1,
      defaultKeepAlive: true,
    });
    this.input = new Input(canvas);
    this.minimap = minimap;

    this.ctx = {
      audio: this.audio,
      say: (title, pages) => this.openDialog(title, pages),
      toast: (text) => this.cb.onToast(text),
      isNight: () => this.night,
      setNight: (night) => this.setNight(night),
      enterHouse: (id) => this.enterHouse(id),
      exitHouse: () => this.exitHouse(),
      boost: (s) => {
        this.boostT = s;
        trackDisplay("town_effect", { effect: "boost", seconds: s });
      },
      grow: (s) => {
        this.growT = s;
        trackDisplay("town_effect", { effect: "grow", seconds: s });
      },
      holdFlower: (color) => this.holdFlower(color),
      dance: (s) => {
        this.danceT = s;
        this.emoteTime = 0;
      },
      playerPosition: () => this.player,
      fadeThrough: (fn) => this.fadeThrough(fn),
      launch: (vy) => {
        this.vy = vy;
        this.grounded = false;
        this.standing = null;
        this.coyote = 0;
        this.jumpBuffer = 0;
      },
      teleport: (x, y, z, facing) => this.placePlayer(x, y, z, facing),
      hud: (patch) => this.patchHud(patch),
    };

    this.town = buildTown(this.ctx);
    this.level = this.town.level;
    this.totalStars = this.town.level.stars.length + HOUSES.length;
    this.character = createCharacter();
    this.hud = {
      location: this.level.opts.name,
      indoor: false,
      prompt: null,
      stars: 0,
      totalStars: this.totalStars,
      night: false,
      muted: false,
      boost: 0,
      grow: 0,
      hop: false,
      hopHeight: 0,
      hopGoal: 0,
      hopTime: null,
      hopBest: null,
      hopCheckpoint: 0,
      hopCheckpoints: 0,
    };
    this.enterLevel(this.level);
    this.buildMinimapBase();

    window.addEventListener("resize", this.resize);
    window.addEventListener("pagehide", this.reportSession);
    this.resize();
    this.cb.onHud({ ...this.hud });
    this.clock.start();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ─── Public API (used by the React HUD) ─────────────────────────────────

  start() {
    if (this.startedAt >= 0) return;
    this.audio.init();
    this.startedAt = this.time;
    trackClick("town_start", { total: this.totalStars });
    this.camTarget.copy(this.player).setY(1.1);
    this.input.clearActions();
  }

  press(action: ActionKey) {
    this.input.press(action);
  }

  setJoystick(x: number, y: number) {
    this.input.setJoystick(x, y);
  }

  setRunButton(held: boolean) {
    this.input.setRunButton(held);
  }

  advanceDialog() {
    if (!this.dialog) return;
    this.dialog.page++;
    if (this.dialog.page >= this.dialog.pages.length) {
      this.dialog = null;
      this.cb.onDialog(null);
      return;
    }
    this.audio.play("talk");
    this.pushDialog();
  }

  toggleMute() {
    this.patchHud({ muted: !this.hud.muted });
    this.audio.setMuted(this.hud.muted);
    trackClick("town_mute", { muted: this.hud.muted });
  }

  toggleNight() {
    this.setNight(!this.night);
    this.cb.onToast(this.night ? "🌙 夜幕降临" : "☀️ 天亮了");
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener("pagehide", this.reportSession);
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.input.dispose();
    this.audio.dispose();
    for (const lvl of [this.town.level, ...this.interiors.values()]) {
      lvl.fx.dispose();
      lvl.glow.dispose();
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ─── Level management ───────────────────────────────────────────────────

  private enterLevel(lvl: Level, spawn?: { x: number; z: number; facing: number }) {
    this.character.root.removeFromParent();
    this.level = lvl;
    lvl.scene.add(this.character.root);
    const s = spawn ?? lvl.opts.spawn;
    const cam = lvl.opts.camera;
    this.yaw = lvl.opts.indoor ? cam.yaw : this.savedYaw;
    this.pitch = cam.pitch;
    this.distance = cam.distance;
    this.placePlayer(s.x, 0, s.z, s.facing);
    lvl.setNight(this.nightK);
    lvl.fx.setViewportHeight(this.viewportScale);
    lvl.glow.setViewportHeight(this.viewportScale);
    this.audio.setIndoor(lvl.opts.indoor);
    this.prompt = null;
    this.promptLabel = null;
    this.patchHud({ location: lvl.opts.name, indoor: lvl.opts.indoor, prompt: null, hop: false });
    this.input.clearActions();
  }

  private placePlayer(x: number, y: number, z: number, facing: number) {
    this.player.set(x, y, z);
    this.vel.set(0, 0);
    this.vy = 0;
    this.grounded = true;
    this.standing = null;
    this.facing = facing;
    this.camDistance = this.distance;
    this.placeCamera(1, true);
    this.placeSun();
  }

  /**
   * Outdoors the shadow frustum only covers the area around the player, so the
   * sun travels with them. A room fits in one frustum, so indoor suns stay put.
   */
  private placeSun() {
    const sun = this.level.sun;
    if (!sun) return;
    const at = this.level.opts.indoor ? ORIGIN : this.player;
    sun.target.position.copy(at);
    sun.position.copy(at).add(this.level.sunOffset);
  }

  private fadeThrough(fn: () => void) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cb.onFade(true);
    window.setTimeout(() => {
      if (this.disposed) return;
      fn();
      this.cb.onFade(false);
      window.setTimeout(() => {
        this.transitioning = false;
      }, 250);
    }, 420);
  }

  private enterHouse(id: HouseId) {
    if (this.transitioning) return;
    this.audio.play("door");
    this.savedYaw = this.yaw;
    this.fadeThrough(() => {
      let lvl = this.interiors.get(id);
      const firstVisit = !lvl;
      if (!lvl) {
        lvl = buildInterior(id, this.ctx);
        this.interiors.set(id, lvl);
        this.renderer.compile(lvl.scene, this.camera);
      }
      this.enterLevel(lvl);
      trackClick("town_house_enter", { house: id, first_visit: firstVisit });
    });
  }

  private exitHouse() {
    if (this.transitioning || !this.level.opts.indoor) return;
    const id = this.level.id as HouseId;
    this.audio.play("door");
    this.fadeThrough(() => {
      this.enterLevel(this.town.level, this.town.doorways[id]);
      trackClick("town_house_exit", { house: id });
    });
  }

  private setNight(night: boolean) {
    if (night !== this.night) trackClick("town_night", { night, location: this.level.opts.name });
    this.night = night;
    this.audio.setNight(night);
    this.patchHud({ night });
  }

  private holdFlower(color: string) {
    this.flower?.removeFromParent();
    const petal = toon(color);
    const f = group(
      mesh(geo.cyl(0.012, 0.012, 0.32, 5), toon("#4f8a3a"), { pos: [0, 0.12, 0] }),
      mesh(geo.sphere(0.035, 8, 6), toon("#FFD166"), { pos: [0, 0.3, 0.02] }),
    );
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      f.add(mesh(geo.sphere(0.045, 8, 6), petal, { pos: [Math.cos(a) * 0.05, 0.3 + Math.sin(a) * 0.05, 0], scale: [1, 1, 0.5] }));
    }
    f.position.set(0, -0.02, 0.04);
    f.rotation.x = 0.5;
    this.character.hand.add(f);
    this.flower = f;
  }

  // ─── Dialogs & HUD ──────────────────────────────────────────────────────

  private openDialog(title: string, pages: string[]) {
    this.dialog = { title, pages, page: 0 };
    this.audio.play("talk");
    this.pushDialog();
  }

  private pushDialog() {
    const d = this.dialog;
    if (!d) return;
    this.cb.onDialog({ title: d.title, text: d.pages[d.page], page: d.page, pages: d.pages.length });
  }

  private patchHud(patch: Partial<HudState>) {
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof HudState>) {
      if (this.hud[key] !== patch[key]) {
        (this.hud as unknown as Record<string, unknown>)[key] = patch[key];
        changed = true;
      }
    }
    if (changed) this.cb.onHud(patch);
  }

  // ─── Frame loop ─────────────────────────────────────────────────────────

  private readonly resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const px = h * this.renderer.getPixelRatio();
    this.viewportScale = px / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.level.fx.setViewportHeight(this.viewportScale);
    this.level.glow.setViewportHeight(this.viewportScale);
  };

  private readonly frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.step(dt);
    this.effect.render(this.level.scene, this.camera);
  };

  private step(dt: number) {
    const started = this.startedAt >= 0;
    if (this.input.consume("mute")) this.toggleMute();
    if (!started) {
      this.input.clearActions();
      this.input.takeLook();
    } else if (this.input.consume("night")) {
      this.toggleNight();
    }

    const frozen = !started || this.transitioning || this.dialog !== null;
    if (this.dialog) {
      if (this.input.consume("interact") || this.input.consume("jump")) this.advanceDialog();
    } else if (!frozen) {
      if (this.input.consume("interact") && this.prompt) {
        trackClick("town_interact", { label: this.promptLabel, location: this.level.opts.name });
        this.prompt.action();
      }
      if (this.input.consume("wave")) {
        this.waveT = 1.6;
        this.danceT = 0;
        this.emoteTime = 0;
      }
      if (this.input.consume("dance")) {
        this.danceT = 4;
        this.emoteTime = 0;
      }
    }

    this.updatePlayer(dt, frozen);
    this.placeSun();
    this.level.update(dt, this.time);
    if (started) {
      this.collectStars();
      this.updatePrompt(frozen);
    }
    this.updateTimers(dt);
    this.updateCamera(dt, started);
    this.updateNight(dt);
    this.drawMinimap(dt);
  }

  private updatePlayer(dt: number, frozen: boolean) {
    const axis = frozen ? { x: 0, y: 0 } : this.input.axis();
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const mx = fx * axis.y + rx * axis.x;
    const mz = fz * axis.y + rz * axis.x;
    const mag = Math.min(1, Math.hypot(mx, mz));
    const running = !frozen && this.input.running();
    const topSpeed = (running ? RUN : WALK) * (this.boostT > 0 ? 1.45 : 1);

    if (mag > 0.1 && this.danceT > 0) this.danceT = 0;
    const accel = 1 - Math.exp(-(mag > 0.01 ? 12 : 10) * dt);
    const tx = mag > 0.01 ? (mx / Math.hypot(mx, mz)) * topSpeed * mag : 0;
    const tz = mag > 0.01 ? (mz / Math.hypot(mx, mz)) * topSpeed * mag : 0;
    this.vel.x += (tx - this.vel.x) * accel;
    this.vel.y += (tz - this.vel.y) * accel;
    const carry = this.grounded ? this.standing?.carry : undefined;
    if (carry) {
      this.player.x += carry.x;
      this.player.y += carry.y;
      this.player.z += carry.z;
    }
    this.player.x += this.vel.x * dt;
    this.player.z += this.vel.y * dt;
    if (mag > 0.05) this.facing = lerpAngle(this.facing, Math.atan2(mx, mz), 1 - Math.exp(-14 * dt));

    if (!frozen && this.input.consume("jump")) this.jumpBuffer = 0.14;
    this.jumpBuffer -= dt;
    this.coyote = this.grounded ? 0.1 : this.coyote - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = JUMP_SPEED * (this.growT > 0 ? 1.08 : 1);
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.audio.play("jump");
      this.dust(4);
    }

    this.vy -= GRAVITY * dt;
    const prevY = this.player.y;
    this.player.y += this.vy * dt;
    const { ground, on } = resolveCollisions(this.player, prevY, RADIUS * this.scale, this.level.colliders, this.vy <= 0, this.hit);
    const b = this.level.opts.bounds;
    this.player.x = THREE.MathUtils.clamp(this.player.x, b.minX, b.maxX);
    this.player.z = THREE.MathUtils.clamp(this.player.z, b.minZ, b.maxZ);
    if (this.player.y <= ground) {
      if (!this.grounded && this.vy < -4) {
        this.character.land(Math.min(1, -this.vy / 14));
        this.audio.play("land");
        this.dust(8);
      }
      this.player.y = ground;
      this.vy = 0;
      this.grounded = true;
      this.standing = on;
      on?.onStand?.();
    } else {
      this.grounded = false;
      this.standing = null;
    }

    const speed = Math.hypot(this.vel.x, this.vel.y);
    if (this.grounded && speed > 0.6) {
      const phase = this.character.stepPhase();
      if (phase < this.lastStepPhase) {
        this.audio.play("step");
        if (running) this.dust(1);
      }
      this.lastStepPhase = phase;
    }
    if (this.boostT > 0 && speed > 3 && Math.random() < dt * 25) {
      this.level.glow.emit({ pos: { x: this.player.x, y: this.player.y + 0.3, z: this.player.z }, spread: 0.3, colors: ["#FFD166", "#5CE0D8"], size: 0.22, life: 0.6, sprite: Sprite.Star });
    }

    const emote = this.danceT > 0 ? "dance" : this.waveT > 0 ? "wave" : "none";
    this.emoteTime += dt;
    this.character.update(dt, this.time, { speed, running, grounded: this.grounded, vy: this.vy, emote, emoteTime: this.emoteTime });
    this.scale += ((this.growT > 0 ? 1.35 : 1) - this.scale) * (1 - Math.exp(-5 * dt));
    const root = this.character.root;
    root.scale.setScalar(this.scale);
    root.position.copy(this.player);
    root.rotation.y = this.facing;
  }

  private dust(count: number) {
    this.level.fx.emit({
      pos: { x: this.player.x, y: this.player.y + 0.08, z: this.player.z },
      count,
      spread: 0.4,
      speed: 1.2,
      vel: [0, 0.3, 0],
      colors: ["#f6ead0", "#ffffff"],
      size: 0.45,
      life: 0.55,
      drag: 3,
      grow: true,
    });
  }

  private collectStars() {
    for (const s of this.level.stars) {
      if (s.collected) continue;
      const p = s.object.position;
      const dh = Math.hypot(p.x - this.player.x, p.z - this.player.z);
      if (dh < 0.95 * this.scale && Math.abs(p.y - (this.player.y + 0.8 * this.scale)) < 1.1 * this.scale) this.collect(s);
    }
  }

  private collect(s: StarPickup) {
    s.collected = true;
    s.object.visible = false;
    this.collected++;
    this.audio.play("star");
    this.level.glow.emit({ pos: s.object.position, count: 40, speed: 4, colors: ["#FFD166", "#FFEAA7", "#ffffff"], size: 0.35, life: 0.9, drag: 2, sprite: Sprite.Star });
    this.patchHud({ stars: this.collected });
    trackDisplay("town_star", {
      id: s.id,
      location: this.level.opts.name,
      count: this.collected,
      total: this.totalStars,
      pos: roundPos(s.object.position),
      play_s: this.playTime(),
    });
    if (this.collected === this.totalStars) {
      trackDisplay("town_star_complete", { total: this.totalStars, play_s: this.playTime() });
      this.audio.play("win");
      for (let i = 0; i < 6; i++) {
        this.level.fx.emit({ pos: { x: this.player.x, y: this.player.y + 2, z: this.player.z }, count: 30, speed: 7, vel: [0, 5, 0], colors: ["#FF8FAB", "#FFD166", "#A78BFA", "#7DD3FC", "#7DFFC7"], size: 0.3, life: 2.5, gravity: 7, drag: 1 });
      }
      this.danceT = 5;
      this.emoteTime = 0;
      this.openDialog("全部收集！", [
        `太厉害了！${this.totalStars} 颗星星全部找到了！`,
        "镇长猫猫决定授予你「trudbot 小镇荣誉镇民」称号 🏅",
        "谢谢你来玩～ 有空常回来看看。",
      ]);
    } else {
      this.cb.onToast(`⭐ 找到星星 ${this.collected} / ${this.totalStars}`);
    }
  }

  /**
   * An MPA never unmounts the game on navigation, so page teardown is the only
   * reliable end of a visit; the analytics client uses sendBeacon, which still
   * delivers from `pagehide`.
   */
  private readonly reportSession = () => {
    if (this.startedAt < 0 || this.sessionReported) return;
    this.sessionReported = true;
    trackDisplay("town_session", {
      play_s: this.playTime(),
      stars: this.collected,
      total: this.totalStars,
      houses: this.interiors.size,
    });
  };

  /** Seconds since the player pressed start. */
  private playTime() {
    return this.startedAt < 0 ? 0 : Math.round((this.time - this.startedAt) * 10) / 10;
  }

  private updatePrompt(frozen: boolean) {
    let best: Interactable | null = null;
    let bestD = Infinity;
    if (!frozen) {
      for (const it of this.level.interactables) {
        if (Math.abs(this.player.y - (it.y ?? 0)) > 2.5) continue;
        const p = it.pos();
        const d = Math.hypot(p.x - this.player.x, p.z - this.player.z);
        if (d < it.radius * Math.max(1, this.scale) && d < bestD) {
          best = it;
          bestD = d;
        }
      }
    }
    this.prompt = best;
    const label = best ? (best.dynamicLabel?.() ?? best.label) : null;
    if (label !== this.promptLabel) {
      this.promptLabel = label;
      this.patchHud({ prompt: label });
    }
  }

  private updateTimers(dt: number) {
    this.boostT = Math.max(0, this.boostT - dt);
    this.growT = Math.max(0, this.growT - dt);
    this.danceT = Math.max(0, this.danceT - dt);
    this.waveT = Math.max(0, this.waveT - dt);
    this.patchHud({ boost: Math.ceil(this.boostT), grow: Math.ceil(this.growT) });
  }

  private updateCamera(dt: number, started: boolean) {
    if (!started) {
      const a = this.time * 0.07;
      this.camera.position.set(Math.sin(a) * 34, 17 + Math.sin(this.time * 0.2) * 2, Math.cos(a) * 34);
      this.camera.lookAt(0, 2, 0);
      return;
    }
    const look = this.input.takeLook();
    const cam = this.level.opts.camera;
    this.yaw -= look.x * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.y * 0.004, 0.08, 1.3);
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + look.zoom), cam.minDistance, cam.maxDistance);

    const blend = Math.min(1, (this.time - this.startedAt) / 1.6);
    this.placeCamera(1 - Math.exp(-(2 + blend * 12) * dt), false, dt);
    this.updateCutaways(dt);
  }

  private placeCamera(t: number, snap: boolean, dt = 0.016) {
    const target = new THREE.Vector3(this.player.x, this.player.y + 1.1 * this.scale, this.player.z);
    if (snap) this.camTarget.copy(target);
    else this.camTarget.lerp(target, 1 - Math.exp(-10 * dt));
    this.camDir.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));

    let want = this.distance;
    if (!this.level.opts.indoor && this.level.cameraBlockers.length) {
      this.raycaster.set(this.camTarget, this.camDir);
      this.raycaster.far = this.distance;
      const hit = this.raycaster.intersectObjects(this.level.cameraBlockers, false)[0];
      if (hit) want = Math.max(1.2, hit.distance - 0.35);
    }
    const rate = want < this.camDistance ? 18 : 4;
    this.camDistance = snap ? want : this.camDistance + (want - this.camDistance) * (1 - Math.exp(-rate * dt));

    const desired = this.camTarget.clone().addScaledVector(this.camDir, this.camDistance);
    desired.y = Math.max(desired.y, 0.4);
    if (snap) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, t);
    this.camera.lookAt(this.camTarget);
  }

  private updateCutaways(dt: number) {
    const k = 1 - Math.exp(-10 * dt);
    for (const c of this.level.cutaways) {
      const d = (this.camera.position.x - c.px) * c.nx + (this.camera.position.z - c.pz) * c.nz;
      const target = d > -0.5 ? 0.06 : 1;
      c.wall.scale.y += (target - c.wall.scale.y) * k;
      c.decor.visible = c.wall.scale.y > 0.5;
    }
  }

  private updateNight(dt: number) {
    const target = this.night ? 1 : 0;
    if (Math.abs(target - this.nightK) < 0.001) return;
    this.nightK += (target - this.nightK) * (1 - Math.exp(-2.5 * dt));
    if (Math.abs(target - this.nightK) < 0.002) this.nightK = target;
    this.level.setNight(this.nightK);
  }

  // ─── Minimap ────────────────────────────────────────────────────────────

  private buildMinimapBase() {
    const canvas = this.minimap;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const size = Math.round((canvas.clientWidth || 150) * dpr);
    canvas.width = canvas.height = size;
    const base = document.createElement("canvas");
    base.width = base.height = size;
    const c = base.getContext("2d")!;
    const s = size / (MAP_RANGE * 2);
    const X = (x: number) => (x + MAP_RANGE) * s;
    const info = this.town.minimap;
    c.fillStyle = "#a6de84";
    c.fillRect(0, 0, size, size);
    c.fillStyle = "#f3e3bf";
    for (const [x, z, w, d] of info.roads) c.fillRect(X(x - w / 2), X(z - d / 2), w * s, d * s);
    c.beginPath();
    c.arc(X(0), X(0), info.plaza * s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#67c7ee";
    c.beginPath();
    c.arc(X(info.pond.x), X(info.pond.z), info.pond.r * s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(167, 139, 250, 0.35)";
    c.beginPath();
    c.arc(X(info.skyhop.x), X(info.skyhop.z), info.skyhop.r * s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#4fae6a";
    for (const [x, z] of info.trees) {
      c.beginPath();
      c.arc(X(x), X(z), 1.2 * s, 0, Math.PI * 2);
      c.fill();
    }
    c.lineWidth = Math.max(1.5, size / 110);
    c.strokeStyle = "#1c1729";
    for (const h of info.houses) {
      c.fillStyle = h.color;
      c.beginPath();
      if (h.round) c.arc(X(h.x), X(h.z), (h.w / 2) * s, 0, Math.PI * 2);
      else c.roundRect(X(h.x - h.w / 2), X(h.z - h.d / 2), h.w * s, h.d * s, 3 * dpr);
      c.fill();
      c.stroke();
    }
    c.fillStyle = "#e9e3d6";
    c.beginPath();
    c.arc(X(0), X(0), 3.5 * s, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#5bbf4a";
    c.beginPath();
    c.arc(X(info.skyhop.x + 4.6), X(info.skyhop.z + 4.6), 2.2 * s, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    this.minimapBase = base;
  }

  private drawMinimap(dt: number) {
    const canvas = this.minimap;
    if (!canvas || !this.minimapBase || this.level.opts.indoor) return;
    this.minimapClock += dt;
    if (this.minimapClock < 0.1) return;
    this.minimapClock = 0;
    const c = canvas.getContext("2d")!;
    const size = canvas.width;
    const s = size / (MAP_RANGE * 2);
    const X = (x: number) => (x + MAP_RANGE) * s;
    c.drawImage(this.minimapBase, 0, 0);
    c.fillStyle = "#FFD166";
    c.strokeStyle = "#1c1729";
    c.lineWidth = Math.max(1, size / 160);
    for (const star of this.town.level.stars) {
      if (star.collected) continue;
      const x = X(star.object.position.x);
      const y = X(star.object.position.z);
      const r = size / 55;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 ? r * 0.45 : r;
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
      c.stroke();
    }
    const cat = this.town.cat.position;
    c.fillStyle = "#FFA94D";
    c.beginPath();
    c.arc(X(cat.x), X(cat.z), size / 70, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    const px = X(this.player.x);
    const py = X(this.player.z);
    const r = size / 26;
    c.save();
    c.translate(px, py);
    c.rotate(-this.facing + Math.PI);
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(r * 0.75, r * 0.8);
    c.lineTo(0, r * 0.4);
    c.lineTo(-r * 0.75, r * 0.8);
    c.closePath();
    c.fillStyle = "#1f8fea";
    c.fill();
    c.lineWidth = Math.max(1.5, size / 90);
    c.strokeStyle = "#ffffff";
    c.stroke();
    c.restore();
  }
}
