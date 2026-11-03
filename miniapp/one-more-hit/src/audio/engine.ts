/*
 * The Web Audio graph shared by music and SFX. Everything is synthesized, so
 * the package stays offline. Callers schedule in game time; `toCtx` maps it
 * onto the audio clock, so judgement never waits on audio callbacks and audio
 * never drifts away from the beat grid the player sees.
 */
import { clock } from "../clock.ts";

export type Bus = "music" | "sfx";
export type Layer = "drums" | "bass" | "harm" | "lead";

interface Route {
  bus: Bus;
  /** Node inside the bus to connect to; defaults to the bus input. */
  dest?: AudioNode;
  send?: number;
  big?: boolean;
  pan?: number;
}

export interface ToneOpts extends Route {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  /** Seconds for the f0→f1 glide; defaults to the whole note. */
  glide?: number;
  /** Context time. */
  at: number;
  dur: number;
  peak: number;
  attack?: number;
  detune?: number;
  lp?: number;
  lpEnd?: number;
  q?: number;
}

export interface NoiseOpts extends Route {
  at: number;
  dur: number;
  peak: number;
  attack?: number;
  filter?: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  rate?: number;
}

// Separate caps so a dense SFX burst can never starve the groove.
const CAP: Record<Bus, number> = { music: 56, sfx: 40 };

function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

class Engine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  /** Reverb sends follow their bus volume so muting a bus also mutes its tail. */
  private sends = {} as Record<Bus, [GainNode, GainNode]>;
  duck!: GainNode;
  lp!: BiquadFilterNode;
  layers = {} as Record<Layer, GainNode>;
  noiseBuf!: AudioBuffer;
  private offset = 0;
  private synced = false;
  private syncedAt = -Infinity;
  private held = false;
  private voices: Record<Bus, number[]> = { music: [], sfx: [] };
  private last = new Map<string, number>();
  private prefs = { music: true, musicVol: 0.8, sfx: true, sfxVol: 0.9 };
  private readyCbs: (() => void)[] = [];

  get ready() {
    return this.ctx !== null;
  }

  onReady(cb: () => void) {
    if (this.ctx) cb();
    else this.readyCbs.push(cb);
  }

  /** Must run inside a user gesture: browsers only start audio from one. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !this.held) void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.22;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(comp);

    const small = ctx.createConvolver();
    small.buffer = impulse(ctx, 1.2, 3);
    const big = ctx.createConvolver();
    big.buffer = impulse(ctx, 4.5, 2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    small.connect(wet);
    big.connect(wet);
    wet.connect(this.master);

    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = 18000;
    this.lp.connect(this.master);
    this.duck = ctx.createGain();
    this.duck.connect(this.lp);
    for (const bus of ["music", "sfx"] as const) {
      const g = ctx.createGain();
      g.connect(bus === "music" ? this.duck : this.master);
      this.buses[bus] = g;
      const s = ctx.createGain();
      const b = ctx.createGain();
      s.connect(small);
      b.connect(big);
      this.sends[bus] = [s, b];
    }
    for (const l of ["drums", "bass", "harm", "lead"] as const) {
      const g = ctx.createGain();
      g.connect(this.buses.music);
      this.layers[l] = g;
    }

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;

    this.applyPrefs(0);
    if (ctx.state === "suspended") void ctx.resume();
    for (const cb of this.readyCbs.splice(0)) cb();
  }

  bus(b: Bus) {
    return this.buses[b];
  }

  setPrefs(p: { music: boolean; musicVol: number; sfx: boolean; sfxVol: number }) {
    this.prefs = { ...p };
    if (this.ctx) this.applyPrefs(0.05);
  }

  private applyPrefs(tc: number) {
    const now = this.ctx!.currentTime;
    // Perceived loudness is roughly quadratic in slider position.
    const vol = { music: this.prefs.music ? this.prefs.musicVol ** 2 : 0, sfx: this.prefs.sfx ? this.prefs.sfxVol ** 2 : 0 };
    for (const b of ["music", "sfx"] as const) {
      const targets = [this.buses[b].gain, this.sends[b][0].gain, this.sends[b][1].gain];
      for (const p of targets) {
        if (tc) p.setTargetAtTime(vol[b], now, tc);
        else p.value = vol[b];
      }
    }
  }

  /** Fades the whole mix, e.g. under the pause screen. */
  fade(to: number, tc = 0.08) {
    if (this.ctx) this.master.gain.setTargetAtTime(to * 0.85, this.ctx.currentTime, tc);
  }

  suspend() {
    this.held = true;
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume() {
    this.held = false;
    this.synced = false;
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  /** Context time at which a game-time instant is heard. */
  toCtx(t: number): number {
    const ctx = this.ctx!;
    this.sync();
    return Math.max(ctx.currentTime + 0.002, t + this.offset);
  }

  private sync() {
    const ctx = this.ctx!;
    const now = performance.now();
    if (this.synced && now - this.syncedAt < 60) return;
    this.syncedAt = now;
    let off: number;
    const ts = ctx.getOutputTimestamp?.();
    if (ts && ts.performanceTime && ts.contextTime) off = ts.contextTime - clock.fromPerf(ts.performanceTime);
    else off = ctx.currentTime - (ctx.outputLatency || 0) - (ctx.baseLatency || 0) - clock.now();
    // Small jitter is smoothed; a real jump (resume, device change) snaps.
    if (!this.synced || Math.abs(off - this.offset) > 0.03) this.offset = off;
    else this.offset += (off - this.offset) * 0.05;
    this.synced = true;
  }

  /**
   * Rejects a stacked copy of the same sound within `gap` seconds; stacks
   * sum into clipping during dense moments without sounding any bigger.
   */
  once(key: string, at: number, gap: number): boolean {
    const l = this.last.get(key);
    if (l !== undefined && Math.abs(at - l) < gap) return false;
    this.last.set(key, at);
    return true;
  }

  private claim(bus: Bus, at: number, dur: number): boolean {
    const now = this.ctx!.currentTime;
    const v = (this.voices[bus] = this.voices[bus].filter((e) => e > now));
    if (v.length >= CAP[bus]) return false;
    v.push(at + dur);
    return true;
  }

  private env(at: number, dur: number, peak: number, attack: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, attack + 0.01));
    return g;
  }

  private route(g: AudioNode, o: Route) {
    const ctx = this.ctx!;
    let out = g;
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      out = p;
    }
    out.connect(o.dest ?? this.buses[o.bus]);
    if (o.send) {
      const s = ctx.createGain();
      s.gain.value = o.send;
      out.connect(s);
      s.connect(this.sends[o.bus][o.big ? 1 : 0]);
    }
  }

  tone(o: ToneOpts) {
    const ctx = this.ctx;
    if (!ctx || !this.claim(o.bus, o.at, o.dur)) return;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.f0, o.at);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.at + (o.glide ?? o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = this.env(o.at, o.dur, o.peak, o.attack ?? 0.004);
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = o.q ?? 0.7;
      f.frequency.setValueAtTime(o.lp, o.at);
      if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, o.at + o.dur);
      osc.connect(f).connect(g);
    } else osc.connect(g);
    this.route(g, o);
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.05);
  }

  noise(o: NoiseOpts) {
    const ctx = this.ctx;
    if (!ctx || !this.claim(o.bus, o.at, o.dur)) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = o.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? "bandpass";
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f0, o.at);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(o.f1, o.at + o.dur);
    const g = this.env(o.at, o.dur, o.peak, o.attack ?? 0.003);
    src.connect(f).connect(g);
    this.route(g, o);
    src.start(o.at, Math.random() * 1.5);
    src.stop(o.at + o.dur + 0.05);
  }

  /** Dips the music under a big hit so the impact owns the moment. */
  duckMusic(at: number, depth: number, release: number) {
    if (!this.ctx) return;
    const g = this.duck.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(depth, at);
    g.linearRampToValueAtTime(1, at + release);
  }

  /** Low-pass on the music bus: muffles it on fail, pause and the pre-finale drop. */
  muffle(freq: number, at?: number, tc = 0.08) {
    if (!this.ctx) return;
    this.lp.frequency.setTargetAtTime(freq, at ?? this.ctx.currentTime, tc);
  }
}

export const audio = new Engine();
