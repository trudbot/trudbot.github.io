/*
 * In-play overlay: level tag, hit counter, combo, beat lights, the QTE bar
 * (sweep) or tap lane (rhythm), grade pop-ups and banners. Positions come
 * straight from the run objects, so what is drawn is what is judged.
 */
import type { Grade, LevelDef } from "../game/config.ts";
import { SweepRun, type Grid, type RhythmRun, type StageRun } from "../game/qte.ts";
import { h, pct, replay } from "./dom.ts";

/** Where the tap lane's hit line sits, as a fraction of its width. */
const LINE = 0.14;

export class Hud {
  readonly el = h("div", "omh-hud");
  private tag = h("div", "omh-tag");
  private count = h("div", "omh-count");
  private combo = h("div", "omh-combo");
  private beats = Array.from({ length: 4 }, () => h("i", "omh-beat"));
  private bar = h("div", "omh-bar");
  private track = h("div", "omh-track");
  private good = h("div", "omh-zone omh-zone-good");
  private perfect = h("div", "omh-zone omh-zone-perfect");
  private pointer = h("div", "omh-pointer");
  private lane = h("div", "omh-lane");
  private notes: HTMLElement[] = [];
  private pop = h("div", "omh-pop");
  private banner = h("div", "omh-banner");
  private crackEl = h("div", "omh-crack");
  private hint = h("div", "omh-hint", "点击 / 空格  出锤");
  private run: StageRun | null = null;
  private settledAt = -1;

  constructor(onPause: () => void) {
    const pause = h("button", "omh-pause", "Ⅱ");
    pause.type = "button";
    pause.setAttribute("aria-label", "暂停");
    pause.addEventListener("click", (e) => {
      e.stopPropagation();
      pause.blur();
      onPause();
    });
    const top = h("div", "omh-top", [h("div", "omh-top-l", [this.tag, this.count]), h("div", "omh-top-r", [this.combo, pause])]);
    this.track.append(this.good, this.perfect, h("div", "omh-line"), this.pointer);
    this.bar.append(h("div", "omh-beats", this.beats), this.track, this.lane);
    this.el.append(top, this.crackEl, this.banner, this.pop, this.bar, this.hint);
    this.lane.append(h("div", "omh-lane-line"));
    this.hide();
  }

  show(level: LevelDef, index: number) {
    this.el.hidden = false;
    this.tag.textContent = `${String(index + 1).padStart(2, "0")}  ${level.name}`;
    this.setCombo(0);
    this.clearRun();
    this.crackEl.classList.remove("on");
    this.banner.className = "omh-banner";
  }

  hide() {
    this.el.hidden = true;
    this.clearRun();
  }

  setCount(done: number, total: number) {
    this.count.innerHTML = `HIT <b>${Math.min(done, total)}</b>/${total}`;
  }

  setCombo(n: number) {
    this.combo.textContent = n >= 2 ? `PERFECT ×${n}` : "";
    if (n >= 2) replay(this.combo, "bump");
  }

  showHint(on: boolean) {
    this.hint.classList.toggle("on", on);
  }

  setRun(run: StageRun) {
    this.run = run;
    this.settledAt = -1;
    this.bar.className = "omh-bar";
    if (run instanceof SweepRun) {
      this.bar.classList.add("is-sweep");
      const [ga, gb] = run.span(run.stage.good);
      const [pa, pb] = run.span(run.stage.perfect);
      Object.assign(this.good.style, { left: pct(ga), width: pct(gb - ga) });
      Object.assign(this.perfect.style, { left: pct(pa), width: pct(pb - pa) });
    } else {
      this.bar.classList.add("is-rhythm");
      for (const n of this.notes) n.remove();
      this.notes = run.taps.map(() => h("i", "omh-note"));
      this.lane.append(...this.notes);
    }
  }

  /** Locks the bar on the result so the player sees where they pressed. */
  settle(grade: Grade, t: number) {
    if (!this.run) return;
    this.settledAt = t;
    this.bar.classList.add(`got-${grade.toLowerCase()}`);
  }

  clearRun() {
    this.run = null;
    this.bar.className = "omh-bar";
  }

  grade(g: Grade, offset: number, extra = "") {
    const late = offset > 0 && Number.isFinite(offset);
    const early = offset < 0;
    const sub = g === "PERFECT" ? extra : g === "MISS" && !Number.isFinite(offset) ? "太慢了" : late ? "偏晚" : early ? "偏早" : "";
    this.pop.className = `omh-pop is-${g.toLowerCase()}`;
    this.pop.replaceChildren(h("b", "", g), ...(sub ? [h("small", "", sub)] : []));
    replay(this.pop, "on");
  }

  say(text: string, sub = "", cls = "") {
    this.banner.className = `omh-banner ${cls}`;
    this.banner.replaceChildren(h("b", "", text), ...(sub ? [h("small", "", sub)] : []));
    replay(this.banner, "on");
  }

  crack() {
    replay(this.crackEl, "on");
  }

  update(t: number, grid: Grid) {
    const beat = (t - grid.anchor) / grid.spb;
    const i = ((Math.floor(beat) % 4) + 4) % 4;
    const glow = Math.exp(-(beat - Math.floor(beat)) * 5);
    this.beats.forEach((b, k) => b.style.setProperty("--g", k === i ? glow.toFixed(3) : "0"));
    const run = this.run;
    if (!run) return;
    const live = t >= run.appear - 0.12 && (this.settledAt < 0 || t - this.settledAt < 0.45);
    this.bar.classList.toggle("on", live);
    if (run instanceof SweepRun) this.drawSweep(run, t);
    else this.drawRhythm(run, t);
  }

  private drawSweep(run: SweepRun, t: number) {
    const at = this.settledAt >= 0 ? this.settledAt : t;
    this.pointer.style.left = pct(run.pos(at));
    this.bar.style.setProperty("--tension", run.tension(at).toFixed(3));
  }

  private drawRhythm(run: RhythmRun, t: number) {
    const span = run.approach * run.grid.spb;
    run.taps.forEach((tap, k) => {
      const n = this.notes[k];
      const res = run.results[k];
      const x = LINE + ((tap - t) / span) * (1 - LINE);
      n.style.left = pct(Math.max(0, x));
      n.className = `omh-note${res ? ` got-${res.grade.toLowerCase()}` : ""}${x > 1.02 ? " far" : ""}`;
    });
    this.bar.style.setProperty("--tension", run.tension(t).toFixed(3));
  }
}
