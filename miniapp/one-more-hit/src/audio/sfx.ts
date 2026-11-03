/*
 * Impact and UI sounds. Each material has its own recipe (ceramic rings,
 * glass sparkles, rock thuds, ice tinkles, planets roar), and `power`
 * (hit quality × target scale) sets weight, length and reverb size.
 */
import type { Grade } from "../game/config.ts";
import { audio, type NoiseOpts, type ToneOpts } from "./engine.ts";

export type Material = "ceramic" | "glass" | "rock" | "ice" | "planet" | "cosmic";

const T = (o: Omit<ToneOpts, "bus">) => audio.tone({ bus: "sfx", ...o });
const N = (o: Omit<NoiseOpts, "bus">) => audio.noise({ bus: "sfx", ...o });
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Maps game time and drops sounds that would stack on an identical one. */
function at(t: number, key?: string, gap = 0.03): number | null {
  if (!audio.ready) return null;
  const c = audio.toCtx(t);
  if (key && !audio.once(key, c, gap)) return null;
  return c;
}

function body(c: number, power: number, scale: number) {
  // The thump every hit shares; its pitch falls as the world grows.
  const f = 120 - 70 * scale;
  T({ f0: f * 2.2, f1: f * 0.5, glide: 0.18 + 0.4 * scale, at: c, dur: 0.35 + 1.4 * scale, peak: 0.55 + 0.35 * power });
  N({ at: c, dur: 0.05, peak: 0.35 * power + 0.15, filter: "highpass", f0: 2500 });
}

function ceramic(c: number, p: number) {
  for (let i = 0; i < 5; i++) {
    const f = rnd(1800, 4200);
    T({ type: "triangle", f0: f, f1: f * 0.94, at: c + rnd(0, 0.03), dur: rnd(0.12, 0.35), peak: 0.07 + 0.05 * p, send: 0.25, pan: rnd(-0.6, 0.6) });
  }
  N({ at: c, dur: 0.18, peak: 0.32, filter: "bandpass", f0: 3500, f1: 1800, q: 1.5 });
  for (let i = 0; i < 6 + 6 * p; i++) N({ at: c + 0.06 + rnd(0, 0.35), dur: 0.03, peak: rnd(0.05, 0.12), filter: "bandpass", f0: rnd(2500, 6000), q: 3, pan: rnd(-0.8, 0.8) });
}

function glass(c: number, p: number) {
  N({ at: c, dur: 0.5, peak: 0.3, filter: "highpass", f0: 5000, send: 0.4 });
  for (let i = 0; i < 10 + 8 * p; i++) {
    const f = rnd(3500, 9000);
    T({ f0: f, at: c + rnd(0, 0.5), dur: rnd(0.08, 0.3), peak: rnd(0.03, 0.06), send: 0.4, pan: rnd(-0.9, 0.9) });
  }
}

function rock(c: number, p: number, scale: number) {
  N({ at: c, dur: 0.45 + 0.8 * scale, peak: 0.55, filter: "lowpass", f0: 1800, f1: 200, send: 0.3, big: scale > 0.4 });
  N({ at: c, dur: 0.12, peak: 0.4, filter: "bandpass", f0: 900, q: 0.8 });
  for (let i = 0; i < 4 + 4 * p; i++) N({ at: c + 0.15 + rnd(0, 0.6), dur: rnd(0.05, 0.12), peak: rnd(0.08, 0.18), filter: "bandpass", f0: rnd(300, 1200), q: 1.5, pan: rnd(-0.7, 0.7) });
}

function ice(c: number, p: number) {
  N({ at: c, dur: 0.25, peak: 0.35, filter: "bandpass", f0: 4200, q: 1.2, send: 0.3 });
  for (let i = 0; i < 7 + 5 * p; i++) {
    const f = rnd(2200, 6500);
    T({ type: "triangle", f0: f, f1: f * 1.04, at: c + rnd(0, 0.4), dur: rnd(0.1, 0.4), peak: rnd(0.03, 0.07), send: 0.5, pan: rnd(-0.9, 0.9) });
  }
  rock(c, p * 0.4, 0.2);
}

function planet(c: number, p: number) {
  T({ f0: 55, f1: 22, glide: 2.5, at: c, dur: 3, peak: 0.85 });
  N({ at: c, dur: 3.2, attack: 0.02, peak: 0.6, filter: "lowpass", f0: 1400, f1: 90, send: 0.6, big: true });
  N({ at: c + 0.05, dur: 1.6, peak: 0.25 + 0.15 * p, filter: "bandpass", f0: 600, f1: 140, q: 0.7, send: 0.4, big: true });
  for (let i = 0; i < 6; i++) N({ at: c + 0.3 + rnd(0, 1.8), dur: rnd(0.2, 0.5), peak: rnd(0.1, 0.22), filter: "lowpass", f0: rnd(300, 800), pan: rnd(-0.8, 0.8) });
}

function cosmic(c: number, p: number) {
  planet(c, p);
  // Rising spectral tail: space itself ringing after the hit.
  for (const [f, d] of [[220, 0], [330, 7], [440, -7], [660, 4]] as const)
    T({ type: "sawtooth", f0: f, f1: f * 2, glide: 2.8, at: c, dur: 3.2, attack: 0.4, peak: 0.035, detune: d, lp: 1200, lpEnd: 5000, send: 0.8, big: true });
  glass(c + 0.25, p);
}

export const sfx = {
  /** Wind-up whoosh ending at the moment of contact. */
  swing(contact: number, power: number) {
    const c = at(contact - 0.12, "swing", 0.06);
    if (c === null) return;
    N({ at: c, dur: 0.16, attack: 0.12, peak: 0.18 + 0.2 * power, filter: "bandpass", f0: 500, f1: 2600, q: 1.2 });
  },

  impact(t: number, m: Material, grade: Grade, power: number, scale: number) {
    const c = at(t, "impact", 0.05);
    if (c === null) return;
    body(c, power, scale);
    if (grade === "PERFECT") {
      // The PERFECT accent: a bright metallic ping above everything else.
      T({ type: "triangle", f0: 2093, at: c, dur: 0.9, peak: 0.16, send: 0.6, big: true });
      T({ f0: 3136, at: c, dur: 0.6, peak: 0.08, send: 0.5 });
    }
    const p = grade === "PERFECT" ? power : power * 0.6;
    ({ ceramic, glass, rock, ice, planet, cosmic })[m](c, p, scale);
    if (scale > 0.3) N({ at: c, dur: 0.6 + 2 * scale, peak: 0.3 * scale, filter: "lowpass", f0: 260, f1: 60, send: 0.3, big: true });
  },

  /** Secondary breakage, e.g. neighbouring pots knocked over by the chain. */
  shatter(t: number, m: Material, power = 0.5) {
    const c = at(t, `shatter-${m}`, 0.04);
    if (c === null) return;
    ({ ceramic, glass, rock, ice, planet, cosmic })[m](c, power * 0.5, 0.1);
  },

  /** Whiff through empty air, then the hammer head dropping dead. */
  miss(t: number) {
    const c = at(t, "miss", 0.2);
    if (c === null) return;
    N({ at: c, dur: 0.3, attack: 0.08, peak: 0.25, filter: "bandpass", f0: 1800, f1: 300, q: 0.9 });
    T({ f0: 90, f1: 45, at: c + 0.22, dur: 0.3, peak: 0.45, lp: 300 });
    N({ at: c + 0.22, dur: 0.18, peak: 0.25, filter: "lowpass", f0: 400 });
    T({ type: "sawtooth", f0: 220, f1: 110, glide: 0.5, at: c + 0.3, dur: 0.6, peak: 0.05, lp: 900 });
  },

  /** Rhythm stage taps climb a pentatonic step each time. */
  tap(t: number, i: number, grade: Grade) {
    const c = at(t, "tap", 0.04);
    if (c === null) return;
    const steps = [0, 3, 5, 7, 10, 12, 15, 17];
    const f = 880 * Math.pow(2, steps[i % steps.length] / 12);
    T({ type: "triangle", f0: f, at: c, dur: 0.4, peak: grade === "PERFECT" ? 0.16 : 0.1, send: 0.4 });
    T({ f0: f * 2.76, at: c, dur: 0.15, peak: 0.05 });
    N({ at: c, dur: 0.05, peak: 0.3, filter: "bandpass", f0: 2400, q: 1 });
    T({ f0: 140, f1: 60, at: c, dur: 0.18, peak: 0.4 });
  },

  /** Boots hitting the ground on overcharge and finisher steps. */
  stomp(t: number, power = 0.5) {
    const c = at(t, "stomp", 0.08);
    if (c === null) return;
    T({ f0: 80, f1: 35, at: c, dur: 0.25, peak: 0.3 + 0.3 * power });
    N({ at: c, dur: 0.2, peak: 0.12 + 0.12 * power, filter: "lowpass", f0: 700 });
  },

  rumble(t: number, dur: number, power = 0.5) {
    const c = at(t, "rumble", 0.3);
    if (c === null) return;
    N({ at: c, dur, attack: dur * 0.3, peak: 0.3 * power, filter: "lowpass", f0: 180, rate: 0.5, send: 0.2, big: true });
  },

  /** Screen glass cracking for the fake ending. */
  crack(t: number) {
    const c = at(t, "crack", 0.1);
    if (c === null) return;
    for (let i = 0; i < 5; i++) N({ at: c + i * rnd(0.02, 0.05), dur: 0.04, peak: 0.3, filter: "highpass", f0: rnd(3000, 7000) });
    T({ f0: 3200, f1: 1200, at: c, dur: 0.3, peak: 0.06, send: 0.4 });
  },

  /** Banner stinger, e.g. "ONE MORE HIT!". */
  sting(t: number) {
    const c = at(t, "sting", 0.2);
    if (c === null) return;
    for (const n of [0, 7, 12]) T({ type: "sawtooth", f0: 220 * Math.pow(2, n / 12), at: c, dur: 0.8, peak: 0.06, lp: 2500, lpEnd: 600, send: 0.5 });
    N({ at: c, dur: 0.6, peak: 0.25, filter: "highpass", f0: 5000, send: 0.5, big: true });
  },

  star(t: number, i: number) {
    const c = at(t);
    if (c === null) return;
    const f = [1047, 1319, 1568][i] ?? 2093;
    T({ type: "triangle", f0: f, at: c, dur: 0.7, peak: 0.16, send: 0.5 });
    T({ f0: f * 2, at: c, dur: 0.3, peak: 0.06 });
  },

  record(t: number) {
    const c = at(t);
    if (c === null) return;
    [1568, 2093, 2637].forEach((f, i) => T({ type: "square", f0: f, at: c + i * 0.07, dur: 0.25, peak: 0.04, lp: 4000, send: 0.4 }));
  },

  click(t: number, hi = false) {
    const c = at(t, "click", 0.03);
    if (c === null) return;
    T({ type: "triangle", f0: hi ? 1760 : 1320, at: c, dur: 0.06, peak: 0.1 });
  },
};
