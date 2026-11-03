/*
 * Synth voices for the soundtrack. Every voice takes a context time and a
 * velocity and routes into one music layer, so a MISS can drop whole layers
 * without touching the rest of the mix.
 */
import { audio, type Layer } from "./engine.ts";

export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const L = (l: Layer) => audio.layers[l];

export function kick(at: number, v = 1) {
  audio.tone({ bus: "music", dest: L("drums"), f0: 160, f1: 42, glide: 0.11, at, dur: 0.38, peak: 0.9 * v });
  audio.noise({ bus: "music", dest: L("drums"), at, dur: 0.02, peak: 0.25 * v, filter: "highpass", f0: 3000 });
}

/** Deep half-time drum for the big chapters. */
export function taiko(at: number, v = 1) {
  audio.tone({ bus: "music", dest: L("drums"), f0: 95, f1: 48, glide: 0.25, at, dur: 0.7, peak: 0.75 * v, send: 0.2, big: true });
  audio.noise({ bus: "music", dest: L("drums"), at, dur: 0.12, peak: 0.25 * v, filter: "lowpass", f0: 600 });
}

export function snare(at: number, v = 1) {
  audio.noise({ bus: "music", dest: L("drums"), at, dur: 0.2, peak: 0.42 * v, filter: "bandpass", f0: 2200, q: 0.8, send: 0.25 });
  audio.tone({ bus: "music", dest: L("drums"), type: "triangle", f0: 210, f1: 150, at, dur: 0.1, peak: 0.3 * v });
}

export function clap(at: number, v = 1) {
  for (let i = 0; i < 3; i++)
    audio.noise({ bus: "music", dest: L("drums"), at: at + i * 0.011, dur: 0.06 + i * 0.05, peak: 0.28 * v, filter: "bandpass", f0: 1500, q: 1.4, send: 0.3 });
}

export function hat(at: number, v = 1, open = false) {
  audio.noise({ bus: "music", dest: L("drums"), at, dur: open ? 0.22 : 0.04, peak: 0.16 * v, filter: "highpass", f0: 7500, pan: 0.25 });
}

/** Anvil clank: inharmonic partials read as struck metal, the game's motif. */
export function anvil(at: number, v = 1, base = 1180) {
  for (const [r, p] of [[1, 0.2], [2.76, 0.11], [5.4, 0.05]] as const)
    audio.tone({ bus: "music", dest: L("drums"), f0: base * r, at, dur: 0.32 / r ** 0.3, peak: p * v, send: 0.35, pan: -0.2 });
}

export function tom(at: number, midi: number, v = 1) {
  audio.tone({ bus: "music", dest: L("drums"), f0: hz(midi) * 1.5, f1: hz(midi), glide: 0.08, at, dur: 0.3, peak: 0.55 * v, send: 0.2 });
}

export function crash(at: number, v = 1) {
  audio.noise({ bus: "music", dest: L("drums"), at, dur: 2.2, peak: 0.3 * v, filter: "highpass", f0: 4500, send: 0.5, big: true });
  audio.noise({ bus: "music", dest: L("drums"), at, dur: 1.2, peak: 0.18 * v, filter: "bandpass", f0: 9000, q: 0.5 });
}

export function bass(at: number, midi: number, dur: number, v = 1, bright = 0) {
  const f = hz(midi);
  audio.tone({ bus: "music", dest: L("bass"), type: "sawtooth", f0: f, at, dur, peak: 0.24 * v, lp: 500 + 1400 * bright, lpEnd: 160, q: 4 });
  audio.tone({ bus: "music", dest: L("bass"), f0: f, at, dur: dur * 1.1, peak: 0.36 * v });
}

/** Sustained chord; the slow attack keeps it under the drums. */
export function pad(at: number, notes: number[], dur: number, v = 1, bright = 0) {
  for (const n of notes)
    for (const d of [-9, 9])
      audio.tone({
        bus: "music",
        dest: L("harm"),
        type: "sawtooth",
        f0: hz(n),
        detune: d,
        at,
        dur,
        attack: Math.min(0.35, dur * 0.3),
        peak: 0.045 * v,
        lp: 900 + 2200 * bright,
        lpEnd: 600,
        send: 0.4,
        pan: d / 30,
      });
}

export function pluck(at: number, midi: number, v = 1, dur = 0.22) {
  audio.tone({ bus: "music", dest: L("lead"), type: "square", f0: hz(midi), at, dur, peak: 0.07 * v, lp: 3200, lpEnd: 500, send: 0.3, pan: 0.15 });
}

export function bell(at: number, midi: number, v = 1) {
  const f = hz(midi);
  audio.tone({ bus: "music", dest: L("lead"), f0: f, at, dur: 1.4, peak: 0.1 * v, send: 0.5, big: true });
  audio.tone({ bus: "music", dest: L("lead"), f0: f * 3.01, at, dur: 0.5, peak: 0.035 * v, send: 0.5 });
}

/** Wide detuned stack for the climax downbeat. */
export function supersaw(at: number, notes: number[], dur: number, v = 1) {
  for (const n of notes)
    for (const d of [-22, -8, 0, 8, 22])
      audio.tone({ bus: "music", dest: L("lead"), type: "sawtooth", f0: hz(n), detune: d, at, dur, attack: 0.01, peak: 0.03 * v, lp: 5200, lpEnd: 900, send: 0.5, big: true, pan: d / 40 });
}

/** Sub drop that sells the scale of a finisher. */
export function boom(at: number, v = 1, dur = 1.6) {
  audio.tone({ bus: "music", dest: L("drums"), f0: 70, f1: 26, glide: dur, at, dur, peak: 0.8 * v });
}

/** Reverse-swell into a downbeat. */
export function swell(at: number, len: number, v = 1) {
  audio.noise({ bus: "music", dest: L("harm"), at: at - len, dur: len, attack: len * 0.95, peak: 0.22 * v, filter: "bandpass", f0: 400, f1: 5000, q: 1.2 });
}
