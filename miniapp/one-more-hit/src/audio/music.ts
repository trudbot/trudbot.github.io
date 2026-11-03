/*
 * The adaptive soundtrack. A lookahead scheduler walks a sixteenth-note grid
 * in game time and hands each step to the current section's pattern. The grid
 * is the same one QTE targets sit on, so beat, pointer and hit line up.
 */
import { clock } from "../clock.ts";
import type { Grid } from "../game/qte.ts";
import { audio } from "./engine.ts";
import * as I from "./instruments.ts";

export type Section =
  | "none"
  | "title"
  | "ready"
  | "charge"
  | "breath"
  | "over"
  | "drop"
  | "climax"
  | "result"
  | "fail"
  | "ending";

interface Mode {
  chords: number[][];
  roots: number[];
}

// i–VI–III–VII for play; I–V–vi–IV once the universe is broken.
const MINOR: Mode = { chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], roots: [0, -4, 3, -2] };
const MAJOR: Mode = { chords: [[0, 4, 7], [-1, 2, 7], [0, 4, 9], [0, 5, 9]], roots: [0, -5, -3, -7] };

const LOOKAHEAD = 0.15;
const mod = (n: number, m: number) => ((n % m) + m) % m;

interface Ctx {
  /** Context time of the step. */
  at: number;
  s: number;
  bar: number;
  /** Steps since the section began. */
  rel: number;
  chord: number[];
  root: number;
  sixteenth: number;
}

class Music {
  grid: Grid = { anchor: 0, spb: 0.6 };
  private key = 57;
  section: Section = "none";
  /** Level progress, 0…1: layers thicken as the stages escalate. */
  private heat = 0;
  /** World size, 0 for the pot up to 1 for the universe. */
  private scale = 0;
  private startStep = 0;
  private next = 0;
  private gaps: [number, number][] = [];
  private cues: number[] = [];
  private tension = 0;
  private riser: { g: GainNode; f: BiquadFilterNode } | null = null;

  constructor() {
    setInterval(() => this.tick(), 25);
    audio.onReady(() => this.buildRiser());
  }

  private stepLen() {
    return this.grid.spb / 4;
  }

  private stepTime(n: number) {
    return this.grid.anchor + n * this.stepLen();
  }

  private stepAt(t: number) {
    return Math.ceil((t - this.grid.anchor) / this.stepLen() - 1e-6);
  }

  /** Sets tempo and key; the first beat lands at `anchor`. */
  configure(bpm: number, key: number, scale: number, anchor: number) {
    this.grid = { anchor, spb: 60 / bpm };
    this.key = key;
    this.scale = scale;
    this.next = this.stepAt(clock.now());
    this.gaps = [];
    this.cues = [];
  }

  play(section: Section, heat = this.heat) {
    const was = this.section;
    this.section = section;
    this.heat = heat;
    this.startStep = Math.max(this.next, this.stepAt(clock.now()));
    if (section !== "fail" && was === "fail") this.restore();
    if (section === "drop") audio.muffle(1400);
    else if (section !== "fail") audio.muffle(18000);
  }

  /**
   * Starts the climax on the player's own impact: the grid re-anchors there,
   * so the downbeat is the hit rather than whatever beat was nearby.
   */
  climax(t: number) {
    this.grid = { anchor: t, spb: this.grid.spb };
    this.next = 0;
    this.gaps = [];
    this.cues = [];
    this.play("climax", 1);
  }

  /** Thins the groove out over a window, leaving room for the next QTE. */
  gap(from: number, to: number) {
    this.gaps.push([from, to]);
  }

  /** Soft ticks exactly on QTE targets, so the beat itself tells the timing. */
  cue(times: number[]) {
    this.cues.push(...times);
    this.cues.sort((a, b) => a - b);
  }

  clearCues() {
    this.cues = [];
  }

  /** A MISS pulls the drums and lead out from under the player at once. */
  miss() {
    const ctx = audio.ctx;
    if (ctx) {
      const now = ctx.currentTime;
      for (const [l, v] of [["drums", 0], ["lead", 0], ["harm", 0.5], ["bass", 0.6]] as const)
        audio.layers[l].gain.setTargetAtTime(v, now, 0.03);
      audio.muffle(700, now, 0.15);
    }
    this.cues = [];
    this.play("fail");
  }

  private restore() {
    const ctx = audio.ctx;
    if (!ctx) return;
    for (const l of ["drums", "bass", "harm", "lead"] as const) audio.layers[l].gain.setTargetAtTime(1, ctx.currentTime, 0.1);
  }

  /** QTE proximity, 0…1, fed every frame; drives the riser under charge. */
  setTension(x: number) {
    this.tension = x;
  }

  private buildRiser() {
    const ctx = audio.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = audio.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 3;
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(audio.layers.lead);
    src.start();
    this.riser = { g, f };
  }

  private tick() {
    if (!audio.ready || clock.paused) return;
    const now = clock.now();
    if (this.riser) {
      const live = this.section === "charge" || this.section === "over" ? 1 : 0;
      const x = this.tension * live;
      const t = audio.ctx!.currentTime;
      this.riser.g.gain.setTargetAtTime(x * x * (0.05 + 0.07 * this.heat), t, 0.06);
      this.riser.f.frequency.setTargetAtTime(400 + 4200 * x * x, t, 0.06);
    }
    // Fell behind (tab throttled, first start): resume from the present.
    if (this.stepTime(this.next) < now - 0.05) this.next = this.stepAt(now);
    const horizon = now + LOOKAHEAD;
    while (this.cues.length && this.cues[0] < horizon) {
      const c = this.cues.shift()!;
      if (c >= now - 0.02) this.tickCue(audio.toCtx(c));
    }
    if (this.section === "none") {
      this.next = this.stepAt(horizon);
      return;
    }
    while (this.stepTime(this.next) < horizon) {
      const n = this.next++;
      const t = this.stepTime(n);
      const bar = Math.floor(n / 16);
      const mode = this.section === "ending" ? MAJOR : MINOR;
      const i = mod(bar, 4);
      const c: Ctx = {
        at: audio.toCtx(t),
        s: mod(n, 16),
        bar,
        rel: n - this.startStep,
        chord: mode.chords[i].map((x) => x + this.key),
        root: mode.roots[i] + this.key,
        sixteenth: this.stepLen(),
      };
      if (this.gaps.some(([a, b]) => t >= a && t < b)) this.thin(c);
      else this.pattern(c);
    }
  }

  private tickCue(at: number) {
    audio.tone({ bus: "music", dest: audio.layers.drums, type: "triangle", f0: 2637, at, dur: 0.06, peak: 0.12 });
    audio.tone({ bus: "music", dest: audio.layers.drums, f0: 1318, at, dur: 0.09, peak: 0.08 });
  }

  /** Breath before a QTE: only a pulse remains. */
  private thin(c: Ctx) {
    if (c.s % 4 === 0) I.hat(c.at, 0.35);
    if (c.s === 0) I.bass(c.at, c.root - 24, c.sixteenth * 16, 0.6);
  }

  private pattern(c: Ctx) {
    const { at, s, chord, root } = c;
    const bar = c.sixteenth * 16;
    const h = this.heat;
    const big = this.scale;
    switch (this.section) {
      case "title":
        if (s === 0 || s === 10) I.kick(at, 0.7);
        if (s === 4 || s === 12) I.clap(at, 0.5);
        if (s % 2 === 0) I.hat(at, s % 4 === 2 ? 0.5 : 0.3);
        if (s === 14) I.anvil(at, 0.45);
        if (s === 0) I.pad(at, chord, bar, 0.8, 0.2);
        if (s === 0 || s === 8) I.bass(at, root - 24, c.sixteenth * 6, 0.8);
        if (s % 2 === 0 && c.bar % 2 === 1) I.pluck(at, chord[(s / 2) % 3] + 12, 0.6);
        break;
      case "ready":
        if (s === 0 || s === 8) I.kick(at, 0.8);
        if (s % 4 === 2) I.hat(at, 0.4);
        if (s === 0) {
          I.pad(at, chord, bar, 0.7);
          I.bass(at, root - 24, c.sixteenth * 8, 0.7);
        }
        break;
      case "charge":
        if (s % 4 === 0) I.kick(at, s === 0 ? 1 : 0.85);
        if (big > 0.4 && s === 0) I.taiko(at, 0.6 + 0.4 * big);
        if (s === 4 || s === 12) (h > 0.3 ? I.clap : I.snare)(at, 0.8);
        if (s % 2 === 0 || h > 0.3) I.hat(at, s % 4 === 2 ? 0.6 : 0.3);
        if (s === 14 || (h > 0.5 && s === 6)) I.anvil(at, 0.6);
        if (s % 2 === 0) I.bass(at, root - (s % 4 === 2 ? 12 : 24), c.sixteenth * 1.8, 0.8, h * 0.5);
        if (s === 0) I.pad(at, chord, bar, 0.8, h * 0.5);
        if (h >= 0.6 && s % 2 === 1) I.pluck(at, chord[(s >> 1) % 3] + 12, 0.45);
        break;
      case "breath":
        if (s === 0) {
          I.kick(at, 0.7);
          I.pad(at, chord, bar, 0.55);
          I.bass(at, root - 24, bar, 0.6);
        }
        if (s === 14) I.hat(at, 0.4, true);
        break;
      case "over": {
        if (s % 4 === 0 || s === 14) I.kick(at, 1);
        if (big > 0.3 && (s === 0 || s === 8)) I.taiko(at, 0.7 + 0.3 * big);
        if (s === 4 || s === 12) I.snare(at, 1);
        if (s >= 12 && c.bar % 2 === 1) I.snare(at, 0.3 + (s - 12) * 0.15);
        I.hat(at, s % 2 === 0 ? 0.55 : 0.3);
        if (s % 4 === 2) I.anvil(at, 0.55, 1180 + 120 * (s >> 2));
        I.bass(at, root - (s % 2 ? 12 : 24), c.sixteenth * 0.9, 0.85, 0.4 + 0.5 * h);
        if (s === 0) I.pad(at, chord, bar, 0.9, 0.6);
        if (s % 2 === 0) I.pluck(at, chord[(s >> 1) % 3] + 12 + (s >= 8 ? 12 : 0), 0.55);
        if (c.bar % 2 === 1 && s >= 12) I.tom(at, root - 12 - (s - 12) * 3, 0.7);
        break;
      }
      case "drop":
        // Near-silence before the last hit: a heartbeat and a held low note.
        if (s === 0 || s === 3) I.kick(at, s === 0 ? 0.55 : 0.35);
        if (s === 0 && c.rel < 16) I.bass(at, root - 24, bar * 2, 0.5);
        break;
      case "climax":
        if (c.rel === 0) {
          I.crash(at, 1);
          I.boom(at, 0.6 + 0.4 * big, 1.2 + 1.6 * big);
          I.supersaw(at, chord.map((x) => x + 12), bar * 0.9, 1);
          I.taiko(at, 1);
        } else if (s === 0) I.crash(at, 0.6);
        if (s % 4 === 0) I.kick(at, 1);
        if (s === 4 || s === 12) I.clap(at, 1);
        I.hat(at, s % 2 === 0 ? 0.6 : 0.35);
        if (s % 4 === 2) I.anvil(at, 0.7);
        I.bass(at, root - (s % 2 ? 12 : 24), c.sixteenth * 0.9, 0.9, 0.8);
        if (s === 0) I.pad(at, chord, bar, 1, 0.8);
        if (s % 2 === 1) I.pluck(at, chord[(s >> 1) % 3] + 24, 0.5);
        if (c.rel >= 31) this.play("result", 0);
        break;
      case "result":
        if (c.rel < 32) {
          if (s === 0) I.kick(at, c.rel < 16 ? 0.8 : 0.5);
          if (s % 4 === 0) I.bell(at, chord[(s >> 2) % 3] + 12, 0.7 - c.rel / 64);
        }
        if (s === 0) I.pad(at, chord, bar, c.rel < 32 ? 0.7 : 0.35, 0.3);
        break;
      case "fail":
        if (s === 0 && c.bar % 2 === 0) {
          I.bass(at, this.key - 24, bar * 2, 0.6);
          I.pad(at, [this.key - 12, this.key - 9, this.key - 5], bar * 2, 0.6);
        }
        break;
      case "ending":
        if (s === 0 || s === 8) I.kick(at, 0.6);
        if (s === 4 || s === 12) I.clap(at, 0.35);
        if (s === 12) I.anvil(at, 0.3, 1568);
        if (s % 2 === 0) I.bell(at, chord[(s >> 1) % 3] + (s >= 8 ? 24 : 12), 0.45);
        if (s === 0) {
          I.pad(at, chord, bar, 0.8, 0.5);
          I.bass(at, root - 24, bar * 0.9, 0.7);
        }
        break;
    }
  }
}

export const music = new Music();
