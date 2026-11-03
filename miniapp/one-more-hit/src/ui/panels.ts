/*
 * Full-screen panels: title with level select, settings, result, fail,
 * pause and ending. Each `show*` replaces the panel's content; actions go
 * back to the director through callbacks.
 */
import { LEVELS, type LevelDef } from "../game/config.ts";
import type { LevelResult } from "../game/scoring.ts";
import { getSave, updateSave, type Settings } from "../save.ts";
import { button, h } from "./dom.ts";

export interface PanelActions {
  start(index: number): void;
  retry(): void;
  next(): void;
  title(): void;
  resume(): void;
  settings(s: Settings): void;
  /** Any button press; the audio engine needs a gesture to start. */
  gesture(): void;
}

const starRow = (n: number, cls = "") => h("div", `omh-stars ${cls}`, [0, 1, 2].map((i) => h("i", i < n ? "on" : "")));

export class Panels {
  readonly el = h("div", "omh-panels");
  private card = h("div", "omh-card");
  /** Primary action for Enter; null when the panel has none. */
  primary: (() => void) | null = null;
  current: "none" | "title" | "settings" | "result" | "fail" | "pause" | "ending" = "none";
  private a: PanelActions;

  constructor(a: PanelActions) {
    this.a = a;
    this.el.append(this.card);
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.hide();
  }

  private open(kind: Panels["current"], cls: string, kids: Node[], primary: (() => void) | null) {
    this.current = kind;
    this.primary = primary;
    this.el.hidden = false;
    this.el.className = `omh-panels is-${kind}`;
    this.card.className = `omh-card ${cls}`;
    this.card.replaceChildren(...kids);
  }

  hide() {
    this.current = "none";
    this.primary = null;
    this.el.hidden = true;
  }

  private act(fn: () => void) {
    return () => {
      this.a.gesture();
      fn();
    };
  }

  /** Highest level the player may start: each one opens once the previous is cleared. */
  private unlocked() {
    const best = getSave().best;
    let i = 0;
    while (i < LEVELS.length - 1 && best[LEVELS[i].id]) i++;
    return i;
  }

  showTitle() {
    const best = getSave().best;
    const open = this.unlocked();
    const list = h(
      "ol",
      "omh-levels",
      LEVELS.map((lv, i) => {
        const b = best[lv.id];
        const locked = i > open;
        const item = h("li", locked ? "locked" : "", [
          h("span", "omh-lv-n", String(i + 1).padStart(2, "0")),
          h("span", "omh-lv-name", [h("b", "", lv.name), h("small", "", lv.en)]),
          locked ? h("span", "omh-lv-lock", "未解锁") : starRow(b?.stars ?? 0, "sm"),
        ]);
        if (!locked) {
          item.tabIndex = 0;
          item.addEventListener("click", this.act(() => this.a.start(i)));
        }
        return item;
      }),
    );
    const go = this.act(() => this.a.start(open));
    this.open(
      "title",
      "omh-title",
      [
        h("div", "omh-logo", [h("small", "", "一锤超限"), h("b", "", "ONE MORE HIT")]),
        h("p", "omh-sub", "看准时机，砸碎一切。"),
        button(open > 0 ? `继续 · 第 ${open + 1} 关` : "开始", "omh-primary", go, "Enter"),
        list,
        button("设置", "omh-ghost", this.act(() => this.showSettings(() => this.showTitle()))),
      ],
      go,
    );
  }

  showSettings(back: () => void) {
    const s = { ...getSave().settings };
    const commit = () => {
      updateSave((v) => ({ ...v, settings: { ...s } }));
      this.a.settings(s);
    };
    const toggle = (label: string, key: "music" | "sfx" | "haptics") => {
      const b = h("button", `omh-toggle${s[key] ? " on" : ""}`, [h("span", "", label), h("i", "")]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(s[key]));
      b.addEventListener("click", () => {
        this.a.gesture();
        s[key] = !s[key];
        b.classList.toggle("on", s[key]);
        b.setAttribute("aria-pressed", String(s[key]));
        commit();
      });
      return b;
    };
    const slider = (key: "musicVol" | "sfxVol") => {
      const r = h("input", "omh-range");
      Object.assign(r, { type: "range", min: "0", max: "1", step: "0.05", value: String(s[key]) });
      r.addEventListener("input", () => {
        s[key] = Number(r.value);
        commit();
      });
      return r;
    };
    this.open(
      "settings",
      "omh-settings",
      [
        h("h2", "", "设置"),
        h("div", "omh-row", [toggle("音乐", "music"), slider("musicVol")]),
        h("div", "omh-row", [toggle("音效", "sfx"), slider("sfxVol")]),
        h("div", "omh-row", [toggle("震动", "haptics")]),
        h("p", "omh-help", "点击屏幕或按空格出锤 · Enter 确认 · R 重试 · Esc 暂停"),
        button("返回", "omh-primary", this.act(back), "Enter"),
      ],
      this.act(back),
    );
  }

  showResult(level: LevelDef, r: LevelResult, record: boolean, last: boolean) {
    const next = this.act(() => this.a.next());
    this.open(
      "result",
      "omh-result",
      [
        h("small", "omh-eyebrow", level.en),
        h("h2", "", "通关"),
        starRow(r.stars, "lg anim"),
        h("div", "omh-stats", [
          h("div", "", [h("small", "", "准确率"), h("b", "", `${(r.accuracy * 100).toFixed(1)}%`)]),
          h("div", "", [h("small", "", "得分"), h("b", "", String(r.score))]),
          h("div", "", [h("small", "", "PERFECT"), h("b", "", String(r.perfects))]),
        ]),
        record ? h("div", "omh-record", "新纪录") : h("div", ""),
        h("div", "omh-actions", [
          button("重试", "omh-ghost", this.act(() => this.a.retry()), "R"),
          button(last ? "终章" : "下一关", "omh-primary", next, "Enter"),
        ]),
        button("返回标题", "omh-link", this.act(() => this.a.title())),
      ],
      next,
    );
  }

  showFail(level: LevelDef, stage: number, why: string) {
    const retry = this.act(() => this.a.retry());
    this.open(
      "fail",
      "omh-fail",
      [
        h("small", "omh-eyebrow", level.en),
        h("h2", "", "失手了"),
        h("p", "omh-sub", `第 ${stage + 1} 锤 · ${why}`),
        h("p", "omh-help", "任意一锤 MISS 都会失败，再来一次。"),
        h("div", "omh-actions", [
          button("返回标题", "omh-ghost", this.act(() => this.a.title())),
          button("重试", "omh-primary", retry, "Enter / R"),
        ]),
      ],
      retry,
    );
  }

  showPause() {
    const resume = this.act(() => this.a.resume());
    this.open(
      "pause",
      "omh-pause-card",
      [
        h("h2", "", "暂停"),
        button("继续", "omh-primary", resume, "Enter"),
        button("重新开始本关", "omh-ghost", this.act(() => this.a.retry()), "R"),
        button("设置", "omh-ghost", this.act(() => this.showSettings(() => this.showPause()))),
        button("返回标题", "omh-link", this.act(() => this.a.title())),
      ],
      resume,
    );
  }

  showEnding(total: number, stars: number) {
    const back = this.act(() => this.a.title());
    this.open(
      "ending",
      "omh-ending",
      [
        h("small", "omh-eyebrow", "THE END"),
        h("h2", "", "宇宙，碎了"),
        h("p", "omh-sub", "而一个新的星系，正从最后一粒火花里诞生。"),
        h("div", "omh-stats", [
          h("div", "", [h("small", "", "总得分"), h("b", "", String(total))]),
          h("div", "", [h("small", "", "星星"), h("b", "", `${stars} / ${LEVELS.length * 3}`)]),
        ]),
        button("回到标题", "omh-primary", back, "Enter"),
      ],
      back,
    );
  }
}
