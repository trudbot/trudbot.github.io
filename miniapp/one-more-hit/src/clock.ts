/**
 * The single game clock, in seconds. Judgement, music scheduling and
 * staging all read it, so they agree even when frames or audio callbacks
 * jitter. It is built on `performance.now()` because input events carry
 * timestamps on that same timeline; pausing freezes it.
 */
let pausedAt: number | null = null;
let pausedTotal = 0;

export const clock = {
  now(): number {
    return ((pausedAt ?? performance.now()) - pausedTotal) / 1000;
  },
  /** Converts a DOM event timestamp to game time. */
  fromEvent(ms: number): number {
    return (ms - pausedTotal) / 1000;
  },
  /** Converts a `performance.now()` value to game time. */
  fromPerf(ms: number): number {
    return (ms - pausedTotal) / 1000;
  },
  toPerf(t: number): number {
    return t * 1000 + pausedTotal;
  },
  get paused() {
    return pausedAt !== null;
  },
  pause() {
    if (pausedAt === null) pausedAt = performance.now();
  },
  resume() {
    if (pausedAt === null) return;
    pausedTotal += performance.now() - pausedAt;
    pausedAt = null;
  },
};

type Task = { at: number; fn: () => void };

/** Callbacks pinned to game time; cleared wholesale on retry. */
export class Timeline {
  private tasks: Task[] = [];

  at(at: number, fn: () => void) {
    this.tasks.push({ at, fn });
    this.tasks.sort((a, b) => a.at - b.at);
  }

  update(now: number) {
    while (this.tasks.length && this.tasks[0].at <= now) this.tasks.shift()!.fn();
  }

  clear() {
    this.tasks = [];
  }
}
