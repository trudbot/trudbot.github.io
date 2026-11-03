/*
 * The game's state machine. It owns the rules side of a level (which stage
 * is live, what was pressed, how it was judged) and tells the theater, music
 * and UI what just happened. Every timed event is pinned to the game clock.
 */
import { audio } from "../audio/engine.ts";
import { music, type Section } from "../audio/music.ts";
import { sfx } from "../audio/sfx.ts";
import { clock, Timeline } from "../clock.ts";
import type { SwingKind } from "../hero/rig.ts";
import { getSave, loadSave, recordBest, type Settings } from "../save.ts";
import type { Hit } from "../scenes/common.ts";
import { onVisibility, vibrate } from "../sdk.ts";
import { Hud } from "../ui/hud.ts";
import { Panels } from "../ui/panels.ts";
import { LEVELS, type Grade, type LevelDef } from "./config.ts";
import { Input, type Action } from "./input.ts";
import { RhythmRun, SweepRun, type Judgement, type StageRun } from "./qte.ts";
import { scoreLevel, type StageRecord } from "./scoring.ts";
import { Theater } from "./theater.ts";

type Phase = "boot" | "title" | "intro" | "play" | "strike" | "fake" | "finale" | "result" | "fail" | "transition" | "ending";

/** Anim-seconds from press to contact; short so the hit feels like the press itself. */
const CONTACT: Record<SwingKind, number> = { normal: 0.055, over: 0.06, finisher: 0.09, spin: 0.09, tap: 0.05, miss: 0.06 };

export class Director {
  private th: Theater;
  private hud: Hud;
  private panels: Panels;
  private input: Input;
  private tl = new Timeline();
  private phase: Phase = "boot";
  private paused = false;
  /** Clock and audio held because the page is hidden, without the pause panel. */
  private held = false;
  private index = 0;
  private level: LevelDef = LEVELS[0];
  private stage = 0;
  private run: StageRun | null = null;
  private records: StageRecord[] = [];
  private combo = 0;
  private revealed = false;
  private over = false;
  private raf = 0;
  private last = 0;
  private disposers: (() => void)[] = [];

  constructor(root: HTMLElement, canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.th = new Theater(canvas);
    this.hud = new Hud(() => this.pause());
    this.panels = new Panels({
      start: (i) => this.start(i),
      retry: () => this.retry(),
      next: () => this.next(),
      title: () => this.toTitle(),
      resume: () => this.resume(),
      settings: (s) => this.applySettings(s),
      gesture: () => audio.unlock(),
    });
    ui.append(this.hud.el, this.panels.el);
    this.input = new Input(root, (a, t) => this.onInput(a, t));
    const resize = () => this.th.resize(root.clientWidth, root.clientHeight);
    const ro = new ResizeObserver(resize);
    ro.observe(root);
    resize();
    this.disposers.push(() => ro.disconnect());
    onVisibility((v) => this.onVisible(v));
    const hide = () => this.dispose();
    window.addEventListener("pagehide", hide);
    this.disposers.push(() => window.removeEventListener("pagehide", hide));
  }

  async boot() {
    const save = await loadSave;
    this.applySettings(save.settings);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.toTitle();
  }

  private applySettings(s: Settings) {
    audio.setPrefs(s);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    for (const d of this.disposers.splice(0)) d();
  }

  private loop = (ms: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.paused || this.held ? 0 : Math.min(0.05, Math.max(0, (ms - this.last) / 1000));
    this.last = ms;
    const t = clock.now();
    if (dt > 0) {
      this.tl.update(t);
      this.tick(t);
    }
    this.th.frame(dt);
    this.hud.update(t, music.grid);
  };

  /** Per-frame rules: timeouts and the tension that drives pose, music and HUD glow. */
  private tick(t: number) {
    const run = this.run;
    if (!run || this.phase !== "play") {
      music.setTension(0);
      this.th.hero.tension = 0;
      this.th.strain = 0;
      return;
    }
    const j = run.update(t);
    if (j) return this.miss(j);
    const k = run.tension(t);
    this.th.hero.tension = k;
    music.setTension(k);
    this.th.strain = this.over ? k : 0;
  }

  private onInput(a: Action, t: number) {
    audio.unlock();
    if (a === "pause") return this.paused ? this.resume() : this.pause();
    if (a === "confirm") return this.panels.primary?.();
    if (a === "retry") {
      if (["intro", "play", "strike", "fail", "result", "finale", "fake"].includes(this.phase) || this.paused) this.retry();
      return;
    }
    if (this.paused) return;
    if (this.phase === "play") this.press(t);
  }

  private onVisible(v: boolean) {
    if (!v) {
      if (this.paused || this.held) return;
      if (this.phase === "play" || this.phase === "intro") return this.pause();
      this.held = true;
      clock.pause();
      audio.suspend();
    } else if (this.held) {
      this.held = false;
      clock.resume();
      audio.resume();
    }
  }

  private pause() {
    if (this.paused || !["intro", "play", "strike", "fake", "finale"].includes(this.phase)) return;
    this.paused = true;
    this.held = false;
    clock.pause();
    audio.suspend();
    this.panels.showPause();
  }

  private resume() {
    if (!this.paused) return;
    this.paused = false;
    this.panels.hide();
    clock.resume();
    audio.resume();
  }

  /** Drops everything in flight; leaves the stage as it stands. */
  private halt() {
    if (this.paused) {
      this.paused = false;
      clock.resume();
      audio.resume();
    }
    this.tl.clear();
    this.run = null;
    this.over = false;
    music.clearCues();
    this.hud.clearRun();
    this.th.renderer.clearShatter();
    this.th.desaturate(0);
    this.th.fade(0, 6);
  }

  private toTitle() {
    this.halt();
    this.phase = "title";
    this.hud.hide();
    const best = getSave().best;
    let open = 0;
    while (open < LEVELS.length - 1 && best[LEVELS[open].id]) open++;
    this.th.use(LEVELS[open].id);
    this.th.cut("title");
    this.th.hero.idle();
    const lv = LEVELS[open];
    music.configure(lv.bpm, lv.key, this.th.world.scale, clock.now() + 0.05);
    music.play("title");
    this.panels.showTitle();
  }

  private start(i: number) {
    this.panels.hide();
    this.enter(i, true);
  }

  /** Puts level `i` on stage and runs its intro; `arrive` flies the camera in. */
  private enter(i: number, arrive: boolean) {
    this.halt();
    this.index = i;
    this.level = LEVELS[i];
    this.th.use(this.level.id);
    this.records = [];
    this.combo = 0;
    this.stage = 0;
    this.revealed = false;
    this.phase = "intro";
    const t = clock.now();
    if (arrive) {
      this.th.cut("arrive");
      this.th.shot("idle", 1.1);
    } else {
      this.th.cut("idle");
    }
    this.th.hero.idle();
    music.configure(this.level.bpm, this.level.key, this.th.world.scale, t + 0.05);
    music.play("ready", 0);
    this.hud.show(this.level, i);
    this.setCount();
    this.hud.say(this.level.name, this.level.tagline, "is-intro");
    const spb = music.grid.spb;
    this.tl.at(t + Math.max(1.6, 4 * spb), () => this.begin(0, clock.now()));
  }

  private retry() {
    if (this.phase === "title" || this.phase === "boot" || this.phase === "ending" || this.phase === "transition") return;
    this.panels.hide();
    this.enter(this.index, false);
  }

  private next() {
    this.panels.hide();
    if (this.index >= LEVELS.length - 1) return this.ending();
    this.halt();
    this.phase = "transition";
    this.hud.hide();
    // The wreck stays on screen while the camera pulls away into white.
    this.th.shot("arrive", 1.4);
    this.th.fade(1, 3.5);
    sfx.rumble(clock.now(), 1.2, 0.4);
    this.tl.at(clock.now() + 0.75, () => {
      this.enter(this.index + 1, true);
      this.th.fade(0, 2.2);
    });
  }

  private ending() {
    this.halt();
    this.phase = "ending";
    this.hud.hide();
    if (this.th.world.id !== "ending") {
      this.th.use("ending");
      this.th.cut("arrive");
    }
    this.th.shot("idle", 0.5);
    if (music.section !== "ending") music.play("ending", 0);
    const best = getSave().best;
    const total = LEVELS.reduce((a, l) => a + (best[l.id]?.score ?? 0), 0);
    const stars = LEVELS.reduce((a, l) => a + (best[l.id]?.stars ?? 0), 0);
    this.panels.showEnding(total, stars);
  }

  private visibleStages() {
    return this.level.stages.filter((s) => this.revealed || !(s.kind === "sweep" && s.surprise)).length;
  }

  private setCount() {
    this.hud.setCount(this.records.length, this.visibleStages());
  }

  private isFinal(k: number) {
    return k === this.level.stages.length - 1;
  }

  /** Every earlier stage was PERFECT: the last swing becomes a finisher. */
  private streak(k: number) {
    return k > 0 && this.records.length === k && this.records.every((r) => r.grade === "PERFECT");
  }

  private begin(k: number, earliest: number) {
    const st = this.level.stages[k];
    const grid = music.grid;
    this.stage = k;
    this.phase = "play";
    const final = this.isFinal(k);
    const run = st.kind === "sweep" ? new SweepRun(st, grid, earliest) : new RhythmRun(st, grid, earliest);
    this.run = run;
    this.hud.setRun(run);
    this.hud.showHint(this.index === 0 && k === 0 && !getSave().best[this.level.id]);
    music.cue(run instanceof SweepRun ? run.targets : run.taps);
    const n = this.level.stages.length;
    const heat = n > 1 ? k / (n - 1) : 1;
    const section: Section = k === 0 ? "charge" : final && this.th.world.scale >= 0.4 ? "drop" : "over";
    if (music.section !== section || section === "charge") music.play(section, heat);
    const hero = this.th.hero;
    this.over = k > 0 && st.kind === "sweep";
    if (st.kind === "rhythm") {
      hero.drum();
      this.th.shot("over", 2.5);
    } else if (final && this.streak(k)) {
      hero.windup({ finisher: true, quick: st.rebound });
      this.th.shot("final", 2);
      this.hud.say("FINISHER", "全 PERFECT · 终结技就绪", "is-finisher");
    } else {
      hero.windup({ over: this.over, quick: st.rebound });
      this.th.shot(k === 0 ? "charge" : final ? "final" : "over", k === 0 ? 1.6 : 2.4);
    }
  }

  private press(t: number) {
    const run = this.run;
    if (!run) return;
    const j = run.press(t);
    if (!j) return;
    this.hud.showHint(false);
    if (j.grade === "MISS") return this.miss(j);
    if (run instanceof SweepRun) this.strike(j);
    else this.tap(j, run);
  }

  private record(j: Judgement, k: number, taps?: Grade[]) {
    this.records.push({ stage: k, grade: j.grade, accuracy: j.accuracy, offset: j.offset, pressAt: j.at, weight: this.level.stages[k].weight, taps });
    this.combo = j.grade === "PERFECT" ? this.combo + 1 : 0;
    this.hud.setCombo(this.combo);
    this.setCount();
  }

  /** Weighted accuracy so far: the finale hits as hard as the whole level was played. */
  private quality() {
    const w = this.records.reduce((a, r) => a + r.weight, 0);
    return w ? this.records.reduce((a, r) => a + r.accuracy * r.weight, 0) / w : 0;
  }

  private nextIsSurprise(k: number) {
    const n = this.level.stages[k + 1];
    return !!n && n.kind === "sweep" && !!n.surprise;
  }

  private strike(j: Judgement) {
    const k = this.stage;
    const final = this.isFinal(k);
    const fake = this.nextIsSurprise(k);
    const streak = final && this.streak(k);
    this.record(j, k);
    this.run = null;
    this.over = false;
    const perfect = j.grade === "PERFECT";
    this.hud.settle(j.grade, j.at);
    this.hud.grade(j.grade, j.offset, this.combo >= 2 ? `连续 ×${this.combo}` : "");
    const kind: SwingKind = final ? (streak ? (perfect ? "spin" : "finisher") : "over") : k > 0 ? "over" : "normal";
    const w = this.th.world;
    const big = final || fake;
    const power = big ? Math.min(1, this.quality() * (perfect ? 1 : 0.8) + (streak ? 0.1 : 0)) : Math.max(0.25, j.accuracy * (perfect ? 1 : 0.8));
    const contactAt = j.at + CONTACT[kind];
    const contactIn = Math.max(0.02, contactAt - clock.now());
    const stop = big ? 0.12 + 0.25 * w.scale + (perfect ? 0.08 : 0) : (perfect ? 0.11 : 0.06) * (0.7 + 0.6 * w.scale);
    sfx.swing(contactAt, power);
    sfx.impact(contactAt, w.material, j.grade, power, big ? w.scale : w.scale * 0.6);
    if (big) {
      music.climax(contactAt);
      if (w.scale >= 0.3) sfx.rumble(contactAt, 1.5 + 2 * w.scale, power);
    }
    music.clearCues();
    this.phase = final ? "finale" : fake ? "fake" : "strike";
    const hit: Hit = { stage: k, grade: j.grade, power };
    this.th.hero.swing(kind, contactIn, () => {
      this.th.hitStop(stop);
      if (final) w.finale(hit);
      else w.hit(hit);
      vibrate(big ? "heavy" : perfect ? "medium" : "light");
    }, big ? 0.14 : 0.06);
    if (final) return this.finish(contactAt, stop, power, kind === "spin");
    if (fake) return this.fakeEnd(contactAt, stop);
    this.then(k, contactAt);
  }

  /** Lines up stage k+1 after a successful hit landing at `contactAt`. */
  private then(k: number, contactAt: number) {
    const nx = this.level.stages[k + 1];
    if (nx.kind === "sweep" && nx.rebound) {
      // The rebound QTE is already moving while the hammer bounces back.
      this.tl.at(contactAt, () => this.begin(k + 1, clock.now()));
      return;
    }
    const spb = music.grid.spb;
    this.tl.at(contactAt + 0.3, () => {
      music.play("breath");
      this.th.shot("idle", 2);
    });
    this.tl.at(contactAt + Math.max(1.1, 2 * spb), () => this.begin(k + 1, clock.now()));
  }

  private tap(j: Judgement, run: RhythmRun) {
    const k = this.stage;
    const i = run.results.length - 1;
    const contactAt = j.at + CONTACT.tap;
    this.hud.grade(j.grade, j.offset, `${i + 1}/${run.taps.length}`);
    sfx.tap(contactAt, i, j.grade);
    const done = run.done;
    const final = done && this.isFinal(k);
    const w = this.th.world;
    const hit: Hit = { stage: k, grade: j.grade, power: j.accuracy };
    this.th.hero.swing("tap", Math.max(0.02, contactAt - clock.now()), () => {
      this.th.hitStop(final ? 0.3 : 0.03);
      if (final) w.finale({ ...hit, power: this.quality() });
      else w.tap(hit, i);
      vibrate(final ? "heavy" : "light");
    }, 0.03);
    if (!done) return;
    const s = run.summary();
    this.record(s, k, run.results.map((r) => r.grade));
    this.run = null;
    this.hud.settle(s.grade, j.at);
    music.clearCues();
    if (final) {
      music.climax(contactAt);
      this.phase = "finale";
      return this.finish(contactAt, 0.3, this.quality(), false);
    }
    this.phase = "strike";
    this.then(k, contactAt);
  }

  private miss(j: Judgement) {
    const k = this.stage;
    const t = clock.now();
    this.run = null;
    this.over = false;
    this.phase = "fail";
    this.combo = 0;
    this.hud.setCombo(0);
    this.hud.settle("MISS", Number.isFinite(j.offset) ? j.at : t);
    this.hud.grade("MISS", j.offset);
    this.hud.showHint(false);
    const w = this.th.world;
    this.th.hero.swing("miss", CONTACT.miss, () => w.miss());
    sfx.miss(t);
    music.miss();
    vibrate("light");
    this.th.desaturate(0.7);
    this.th.shot("idle", 1.2);
    const why = !Number.isFinite(j.offset) ? "错过了时机" : j.offset < 0 ? "出手太早" : "出手太晚";
    this.tl.at(t + 1.4, () => {
      this.hud.clearRun();
      this.panels.showFail(this.level, k, why);
    });
  }

  /**
   * The level plays its ending a stage early: climax, victory pose, a
   * "clear" banner. Then the screen cracks and the hidden stage springs up.
   */
  private fakeEnd(contactAt: number, stop: number) {
    const k = this.stage;
    this.tl.at(contactAt + 0.1, () => this.hud.say("CLEAR", "宇宙……碎了？", "is-clear"));
    this.tl.at(contactAt + stop + 0.1, () => this.th.shot("impact", 1.4));
    this.tl.at(contactAt + 1.1, () => this.th.hero.victory());
    this.tl.at(contactAt + 1.6, () => this.th.shot("result", 1.4));
    this.tl.at(contactAt + 2.8, () => {
      this.hud.crack();
      sfx.crack(clock.now());
      this.th.ctx.shake(0.35);
      vibrate("medium");
    });
    this.tl.at(contactAt + 3.4, () => {
      this.revealed = true;
      sfx.sting(clock.now());
      this.th.world.reveal();
      music.play("drop", 1);
      vibrate("heavy");
      this.begin(k + 1, clock.now() + 0.2);
      const streak = this.streak(k + 1);
      this.hud.say("ONE MORE HIT!", streak ? "全 PERFECT · 终结技就绪" : "它还没碎完", "is-surprise");
      this.setCount();
    });
  }

  private finish(contactAt: number, stop: number, power: number, overlimit: boolean) {
    const result = scoreLevel(this.level, this.records);
    const lv = this.level;
    const record = result.passed && recordBest(lv.id, { stars: result.stars, score: result.score, accuracy: result.accuracy });
    const q = this.quality();
    const [title, sub] = overlimit ? ["OVERLIMIT!", "全 PERFECT 终结"] : q >= 0.92 ? ["SHATTERED", "完美粉碎"] : q >= 0.7 ? ["SMASH", "粉碎"] : ["CRACKED", "勉强砸开"];
    this.tl.at(contactAt + 0.08, () => {
      this.hud.say(title, sub, `is-final q${Math.round(power * 3)}`);
      this.hud.clearRun();
    });
    this.tl.at(contactAt + stop + 0.05, () => this.th.shot("impact", 1.3));
    const last = this.index === LEVELS.length - 1;
    if (last) {
      // The universe takes the screen with it: the frame shatters into the void.
      this.tl.at(contactAt + 2.2, () => {
        const t = clock.now();
        this.th.renderer.shatter(this.th.scene, this.th.rig.cam);
        sfx.crack(t);
        sfx.impact(t, "glass", "PERFECT", 0.8, 0.5);
        this.hud.hide();
        this.th.use("ending");
        this.th.cut("arrive");
        this.th.shot("idle", 0.45);
        music.play("ending", 0);
      });
      this.tl.at(contactAt + 5.5, () => this.showResult(result, record, true));
      return;
    }
    this.tl.at(contactAt + 1.2, () => this.th.hero.victory());
    this.tl.at(contactAt + 2.3, () => this.th.shot("result", 1.4));
    this.tl.at(contactAt + 3, () => this.showResult(result, record, false));
  }

  private showResult(result: ReturnType<typeof scoreLevel>, record: boolean, last: boolean) {
    this.phase = "result";
    this.hud.hide();
    this.panels.showResult(this.level, result, record, last);
    const t = clock.now();
    for (let i = 0; i < result.stars; i++) sfx.star(t + 0.35 + i * 0.28, i);
    if (record) sfx.record(t + 0.35 + result.stars * 0.28 + 0.2);
    // Build the next world while the player reads the result, not during the transition.
    const nx = LEVELS[this.index + 1];
    if (nx) setTimeout(() => this.th.get(nx.id), 700);
  }
}
