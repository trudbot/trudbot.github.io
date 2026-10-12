/*
 * Synthesised sound effects. Everything is generated with Web Audio at play
 * time: the mini-program may not load external assets, and a handful of
 * oscillators is far lighter than bundling samples.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let noise: AudioBuffer | null = null;

export const setSound = (on: boolean) => {
  enabled = on;
};

/**
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily from the first tap and resumed again after the Host backgrounds us.
 */
export function unlockAudio() {
  if (!enabled) return;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function ready(): [AudioContext, GainNode] | null {
  if (!enabled || !ctx || !master || ctx.state !== "running") return null;
  return [ctx, master];
}

function env(c: AudioContext, at: number, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

function tone(
  type: OscillatorType,
  from: number,
  to: number,
  at: number,
  dur: number,
  peak: number,
  dest?: AudioNode,
) {
  const r = ready();
  if (!r) return;
  const [c, out] = r;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = env(c, at, peak, Math.min(0.01, dur / 4), dur);
  o.connect(g).connect(dest ?? out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function burst(at: number, dur: number, peak: number, freq: number, q: number) {
  const r = ready();
  if (!r || !noise) return;
  const [c, out] = r;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = env(c, at, peak, 0.002, dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.3);
  src.stop(at + dur + 0.05);
}

const now = () => ctx?.currentTime ?? 0;

export const sfx = {
  /** Heavy metal switch: a thump under a bright mechanical click. */
  rotate() {
    const t = now();
    tone("sine", 160, 60, t, 0.07, 0.5);
    burst(t, 0.035, 0.6, 3200, 1.4);
  },
  lock() {
    const t = now();
    burst(t, 0.03, 0.5, 5200, 3);
    burst(t + 0.06, 0.04, 0.6, 2400, 3);
    tone("square", 900, 880, t + 0.06, 0.05, 0.05);
  },
  /** Current arriving: a rising buzz whose length grows with the tiles reached. */
  connect(tiles: number) {
    const t = now();
    const len = Math.min(0.12 + tiles * 0.025, 0.45);
    tone("sawtooth", 140, 520 + tiles * 30, t + 0.1, len, 0.12);
    tone("sine", 880, 1760, t + 0.1, len * 0.8, 0.06);
    burst(t + 0.1, 0.08, 0.35, 6000, 0.8);
  },
  short() {
    const t = now();
    const r = ready();
    if (!r) return;
    const [c, out] = r;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = 58;
    const lfo = c.createOscillator();
    lfo.frequency.value = 23;
    const depth = c.createGain();
    depth.gain.value = 0.12;
    const g = env(c, t, 0.18, 0.005, 0.32);
    lfo.connect(depth).connect(g.gain);
    o.connect(g).connect(out);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.4);
    lfo.stop(t + 0.4);
    burst(t, 0.25, 0.5, 1800, 0.6);
  },
  /** Generator spinning up, then a major chord as the lights come on. */
  win() {
    const t = now();
    tone("sawtooth", 55, 220, t, 0.9, 0.14);
    tone("sine", 110, 440, t, 0.9, 0.2);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone("triangle", f, f, t + 0.75 + i * 0.09, 0.9, 0.12),
    );
    burst(t + 0.72, 0.4, 0.4, 7000, 0.5);
  },
  tap() {
    burst(now(), 0.02, 0.35, 4200, 2);
  },
  deny() {
    const t = now();
    tone("square", 220, 180, t, 0.09, 0.08);
    tone("square", 160, 120, t + 0.1, 0.12, 0.08);
  },
  lever() {
    const t = now();
    burst(t, 0.05, 0.6, 1500, 1.2);
    tone("sine", 90, 45, t, 0.25, 0.5);
    burst(t + 0.18, 0.04, 0.6, 3800, 2);
  },
};
