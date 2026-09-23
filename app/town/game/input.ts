import type { ActionKey } from "./types";

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const ACTION_KEYS: Record<string, ActionKey> = {
  Space: "jump",
  KeyE: "interact",
  Enter: "interact",
  KeyF: "interact",
  KeyQ: "wave",
  KeyR: "dance",
  KeyN: "night",
  KeyM: "mute",
};

export class Input {
  private readonly held = new Set<string>();
  private readonly queued = new Set<ActionKey>();
  private joyX = 0;
  private joyY = 0;
  private runButton = false;
  /** Camera deltas accumulated since the last frame, in pixels. */
  lookX = 0;
  lookY = 0;
  zoom = 0;
  enabled = true;

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private readonly disposers: Array<() => void> = [];

  constructor(private readonly surface: HTMLElement) {
    this.listen(window, "keydown", (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(window, "keyup", (e) => this.onKey(e as KeyboardEvent, false));
    this.listen(window, "blur", () => this.held.clear());
    this.listen(surface, "pointerdown", (e) => this.onPointerDown(e as PointerEvent));
    this.listen(window, "pointermove", (e) => this.onPointerMove(e as PointerEvent));
    this.listen(window, "pointerup", (e) => this.onPointerUp(e as PointerEvent));
    this.listen(window, "pointercancel", (e) => this.onPointerUp(e as PointerEvent));
    this.listen(surface, "wheel", (e) => {
      e.preventDefault();
      this.zoom += (e as WheelEvent).deltaY * 0.0015;
    }, { passive: false });
    this.listen(surface, "contextmenu", (e) => e.preventDefault());
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts);
    this.disposers.push(() => target.removeEventListener(type, fn, opts));
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    const code = e.code;
    if (code in MOVE_KEYS || code === "Space") e.preventDefault();
    if (down) {
      this.held.add(code);
      const action = ACTION_KEYS[code];
      if (action && !e.repeat) this.queued.add(action);
    } else {
      this.held.delete(code);
    }
  }

  private onPointerDown(e: PointerEvent) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinch();
  }

  private onPointerMove(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    if (this.pointers.size === 1) {
      this.lookX += e.clientX - prev.x;
      this.lookY += e.clientY - prev.y;
    }
    prev.x = e.clientX;
    prev.y = e.clientY;
    if (this.pointers.size === 2) {
      const d = this.currentPinch();
      if (this.pinchDistance > 0) this.zoom -= (d - this.pinchDistance) * 0.01;
      this.pinchDistance = d;
    }
  }

  private onPointerUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
  }

  private currentPinch() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  setJoystick(x: number, y: number) {
    this.joyX = x;
    this.joyY = y;
  }

  setRunButton(held: boolean) {
    this.runButton = held;
  }

  press(action: ActionKey) {
    this.queued.add(action);
  }

  consume(action: ActionKey) {
    const had = this.queued.has(action);
    this.queued.delete(action);
    return had;
  }

  clearActions() {
    this.queued.clear();
  }

  takeLook() {
    const look = { x: this.lookX, y: this.lookY, zoom: this.zoom };
    this.lookX = this.lookY = this.zoom = 0;
    return look;
  }

  /** Movement intent: x = strafe right, y = forward, length ≤ 1. */
  axis() {
    let x = this.joyX;
    let y = this.joyY;
    for (const code of this.held) {
      const m = MOVE_KEYS[code];
      if (m) {
        x += m[0];
        y += m[1];
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  running() {
    return (
      this.runButton ||
      this.held.has("ShiftLeft") ||
      this.held.has("ShiftRight") ||
      Math.hypot(this.joyX, this.joyY) > 0.85
    );
  }

  dispose() {
    for (const d of this.disposers) d();
  }
}
