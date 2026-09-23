type Sfx =
  | "step"
  | "jump"
  | "land"
  | "star"
  | "door"
  | "talk"
  | "meow"
  | "boost"
  | "grow"
  | "win"
  | "pop"
  | "arcade"
  | "claw"
  | "whoosh"
  | "spring"
  | "checkpoint"
  | "crumble";

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// One 8th note per entry; 0 = rest, -1 = hold the previous note.
const MELODY: number[] = [
  76, -1, 79, 76, 74, -1, 72, -1,
  72, -1, 76, -1, 69, -1, -1, -1,
  77, -1, 76, 77, 81, -1, 79, -1,
  74, -1, -1, 71, 67, -1, -1, -1,
  76, -1, 79, 76, 84, -1, 83, 81,
  79, -1, 76, -1, 72, -1, 74, 76,
  77, -1, 81, -1, 74, -1, 77, 76,
  74, -1, 71, -1, 72, -1, -1, 0,
];
const CHORDS: number[][] = [
  [48, 52, 55],
  [45, 48, 52],
  [41, 45, 48],
  [43, 47, 50],
  [48, 52, 55],
  [45, 48, 52],
  [38, 41, 45],
  [43, 47, 50],
];

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private muted = false;
  private night = false;
  private schedulerId: number | null = null;
  private step = 0;
  private nextTime = 0;

  /** Must run inside a user gesture, otherwise browsers keep the context suspended. */
  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 12000;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.2;
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setNight(night: boolean) {
    this.night = night;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(night ? 0.13 : 0.2, this.ctx.currentTime, 0.5);
  }

  setIndoor(indoor: boolean) {
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(indoor ? 1400 : 12000, this.ctx.currentTime, 0.3);
  }

  dispose() {
    if (this.schedulerId !== null) window.clearInterval(this.schedulerId);
    void this.ctx?.close();
    this.ctx = null;
  }

  // ─── Primitives ──────────────────────────────────────────────────────────

  private tone(
    freq: number,
    dur: number,
    o: { type?: OscillatorType; vol?: number; at?: number; slide?: number; attack?: number; bus?: AudioNode } = {},
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const vol = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.bus ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private hiss(dur: number, o: { freq?: number; q?: number; type?: BiquadFilterType; vol?: number; at?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? "lowpass";
    f.frequency.value = o.freq ?? 800;
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Bell-like pluck: fundamental plus a quiet octave partial with a fast decay. */
  private pluck(note: number, at: number, dur: number, vol: number, bus: AudioNode) {
    this.tone(midi(note), dur, { type: "triangle", vol, at, bus });
    this.tone(midi(note + 12), dur * 0.5, { type: "sine", vol: vol * 0.35, at, bus });
  }

  // ─── Music ───────────────────────────────────────────────────────────────

  private startMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.nextTime = ctx.currentTime + 0.1;
    this.step = 0;
    this.schedulerId = window.setInterval(() => this.schedule(), 50);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const eighth = 60 / (this.night ? 76 : 100) / 2;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const i = this.step % MELODY.length;
      const bar = Math.floor(i / 8);
      const beat = i % 8;
      const note = MELODY[i];
      if (note > 0) {
        let len = 1;
        while (MELODY[(i + len) % MELODY.length] === -1 && len < 4) len++;
        this.pluck(this.night ? note - 12 : note, this.nextTime, eighth * len + 0.4, 0.22, this.musicBus);
      }
      const chord = CHORDS[bar];
      if (beat === 0 || beat === 4) {
        this.tone(midi(chord[0] - 12), eighth * 3.5, { type: "triangle", vol: 0.28, at: this.nextTime, bus: this.musicBus });
      }
      if (beat === 2 || beat === 6) {
        for (const n of chord) this.tone(midi(n + 12), eighth * 1.6, { vol: 0.05, at: this.nextTime, bus: this.musicBus });
      }
      this.nextTime += eighth;
      this.step++;
    }
  }

  // ─── Sound effects ───────────────────────────────────────────────────────

  play(name: Sfx) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (name) {
      case "step":
        this.hiss(0.06, { freq: 700 + Math.random() * 400, vol: 0.12 });
        break;
      case "jump":
        this.tone(320, 0.18, { type: "sine", slide: 720, vol: 0.2 });
        break;
      case "land":
        this.tone(140, 0.14, { slide: 55, vol: 0.3 });
        this.hiss(0.1, { freq: 500, vol: 0.12 });
        break;
      case "star":
        [84, 88, 91, 96].forEach((n, i) => this.pluck(n, t + i * 0.06, 0.35, 0.18, this.sfxBus));
        break;
      case "door":
        this.pluck(79, t, 0.7, 0.2, this.sfxBus);
        this.pluck(84, t + 0.14, 0.9, 0.2, this.sfxBus);
        break;
      case "talk":
        for (let i = 0; i < 3; i++) this.tone(500 + Math.random() * 400, 0.05, { type: "square", vol: 0.04, at: t + i * 0.06 });
        break;
      case "meow": {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.linearRampToValueAtTime(1050, t + 0.15);
        osc.frequency.linearRampToValueAtTime(620, t + 0.5);
        f.type = "bandpass";
        f.frequency.setValueAtTime(1400, t);
        f.frequency.linearRampToValueAtTime(900, t + 0.5);
        f.Q.value = 3;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.connect(f).connect(g).connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + 0.6);
        break;
      }
      case "boost":
        this.tone(200, 0.5, { type: "sawtooth", slide: 1200, vol: 0.08 });
        this.tone(400, 0.5, { type: "sine", slide: 1600, vol: 0.12 });
        break;
      case "grow":
        [60, 64, 67, 72, 76].forEach((n, i) => this.tone(midi(n), 0.2, { type: "square", vol: 0.05, at: t + i * 0.08 }));
        break;
      case "win":
        [72, 76, 79, 84, 79, 84, 88].forEach((n, i) =>
          this.pluck(n, t + i * 0.13, i === 6 ? 1.2 : 0.3, 0.2, this.sfxBus),
        );
        break;
      case "pop":
        this.tone(900, 0.08, { slide: 300, vol: 0.15 });
        break;
      case "arcade":
        [72, 76, 79, 84, 83, 79, 84, 91].forEach((n, i) =>
          this.tone(midi(n), 0.1, { type: "square", vol: 0.06, at: t + i * 0.09 }),
        );
        break;
      case "claw":
        this.tone(220, 0.8, { type: "square", slide: 440, vol: 0.04 });
        break;
      case "whoosh":
        this.hiss(0.4, { freq: 1200, type: "bandpass", q: 0.8, vol: 0.18 });
        break;
      case "spring":
        this.tone(180, 0.32, { type: "sine", slide: 900, vol: 0.24 });
        this.tone(360, 0.22, { type: "triangle", slide: 1400, vol: 0.08, at: t + 0.03 });
        break;
      case "checkpoint":
        [79, 83, 86, 91].forEach((n, i) => this.pluck(n, t + i * 0.08, 0.4, 0.18, this.sfxBus));
        break;
      case "crumble":
        this.hiss(0.35, { freq: 380, type: "lowpass", vol: 0.22 });
        this.tone(160, 0.25, { type: "square", slide: 70, vol: 0.04 });
        break;
    }
  }

  /** Plays a sequence of [midi, beats] pairs; 0 is a rest. */
  melody(notes: Array<[number, number]>, bpm = 132, voice: "piano" | "chip" = "piano") {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const beat = 60 / bpm;
    let t = ctx.currentTime + 0.02;
    for (const [n, beats] of notes) {
      if (n > 0) {
        if (voice === "piano") {
          this.tone(midi(n), beats * beat + 0.6, { type: "triangle", vol: 0.22, at: t });
          this.tone(midi(n) * 2, beats * beat * 0.5 + 0.2, { type: "sine", vol: 0.06, at: t });
        } else {
          this.tone(midi(n), beats * beat * 0.9, { type: "square", vol: 0.05, at: t });
        }
      }
      t += beats * beat;
    }
    return t - ctx.currentTime;
  }

  drum(kind: "kick" | "snare" | "hat", delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const at = ctx.currentTime + delay;
    if (kind === "kick") this.tone(150, 0.25, { slide: 40, vol: 0.5, at });
    else if (kind === "snare") {
      this.hiss(0.18, { freq: 1800, type: "bandpass", vol: 0.3, at });
      this.tone(220, 0.08, { type: "triangle", vol: 0.15, at });
    } else this.hiss(0.05, { freq: 7000, type: "highpass", vol: 0.12, at });
  }
}
