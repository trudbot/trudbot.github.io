/*
 * Keyboard and pointer input in one place. Presses carry the event's own
 * timestamp converted to game time, so judgement does not depend on when the
 * frame got around to handling them.
 */
import { clock } from "../clock.ts";

export type Action = "hit" | "confirm" | "retry" | "pause";

/** One physical press can arrive as pointer + key or as touch + mouse; anything closer than this is the same press. */
const DEDUPE = 0.04;

export class Input {
  private last = -Infinity;
  private off: (() => void)[] = [];

  constructor(root: HTMLElement, on: (a: Action, t: number) => void) {
    const listen = <K extends keyof WindowEventMap>(target: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    const press = (t: number) => {
      if (t - this.last < DEDUPE) return;
      this.last = t;
      on("hit", t);
    };
    listen(root, "pointerdown", (e) => {
      if (!e.isPrimary || e.button > 0) return;
      const el = e.target as HTMLElement;
      if (el.closest("button, input, .omh-panels")) return;
      e.preventDefault();
      press(clock.fromEvent(e.timeStamp));
    });
    listen(window, "keydown", (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = clock.fromEvent(e.timeStamp);
      switch (e.code) {
        case "Space":
          e.preventDefault();
          press(t);
          break;
        case "Enter":
        case "NumpadEnter":
          e.preventDefault();
          on("confirm", t);
          break;
        case "KeyR":
          on("retry", t);
          break;
        case "Escape":
        case "KeyP":
          on("pause", t);
          break;
      }
    });
    // Long-press menus and double-tap zoom would eat rapid hits on phones.
    listen(root, "contextmenu", (e) => e.preventDefault());
  }

  dispose() {
    for (const f of this.off.splice(0)) f();
  }
}
