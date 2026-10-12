/*
 * Multi-source Net: tile model, play-state analysis, uniqueness solver and
 * level generator.
 *
 * Based on Net from Simon Tatham's Portable Puzzle Collection (MIT licence,
 * copyright (c) 2004-2024 Simon Tatham and contributors). The tile bit layout
 * and the tree-growing generator follow net.c; the solver is a separate
 * constraint-propagation design because net.c's single-source deductions do
 * not hold once several coloured sources share the grid.
 *
 * Rules: every tile must be connected, all wire ends must meet, the network
 * must be a forest, and every tree must contain exactly one source. Colours
 * are not shown up front, so the solver may only use those rules.
 *
 * This file must stay import-free and use erasable TypeScript only: the
 * level script runs it directly under Node's type stripping.
 */

// ─── Tiles ──────────────────────────────────────────────────────────────────
// A tile is a 4-bit mask of the edges it connects to.
export const R = 1;
export const U = 2;
export const L = 4;
export const D = 8;
export const DIRS = [R, U, L, D] as const;

/** One clockwise quarter turn on screen (y points down): R→D→L→U→R. */
export function rotateCW(v: number): number {
  return ((v & 0x0e) >> 1) | ((v & 0x01) << 3);
}

export function rotateCWBy(v: number, turns: number): number {
  for (let i = 0; i < (turns & 3); i++) v = rotateCW(v);
  return v;
}

export function opposite(d: number): number {
  return ((d & 0x0c) >> 2) | ((d & 0x03) << 2);
}

export function popcount(v: number): number {
  let n = 0;
  for (; v; v &= v - 1) n++;
  return n;
}

const DX: Record<number, number> = { [R]: 1, [U]: 0, [L]: -1, [D]: 0 };
const DY: Record<number, number> = { [R]: 0, [U]: -1, [L]: 0, [D]: 1 };

/** Static layout shared by play, solving and generation. */
export interface Board {
  w: number;
  h: number;
  wrap: boolean;
  /** Per tile, the edges blocked by a barrier. Must be symmetric across each edge. */
  barriers: ArrayLike<number>;
  /** Tile index of each source; the array position is the source's colour. */
  sources: readonly number[];
}

/** Neighbouring tile index through edge `d`, or -1 if the grid edge or a barrier is in the way. */
export function neighbor(board: Board, i: number, d: number): number {
  if (board.barriers[i] & d) return -1;
  const { w, h } = board;
  let x = (i % w) + DX[d];
  let y = Math.floor(i / w) + DY[d];
  if (board.wrap) {
    x = (x + w) % w;
    y = (y + h) % h;
  } else if (x < 0 || y < 0 || x >= w || y >= h) {
    return -1;
  }
  return y * w + x;
}

// ─── Play-state analysis ────────────────────────────────────────────────────
export const UNPOWERED = -1;
export const SHORT_CIRCUIT = -2;

export interface Analysis {
  /** Per tile: source colour powering it, UNPOWERED, or SHORT_CIRCUIT. */
  owner: Int8Array;
  /** Per tile: the arms whose edge lies on a closed loop. */
  loopArms: Uint8Array;
  solved: boolean;
}

function matched(board: Board, tiles: ArrayLike<number>, i: number, d: number): number {
  if (!(tiles[i] & d)) return -1;
  const n = neighbor(board, i, d);
  return n >= 0 && tiles[n] & opposite(d) ? n : -1;
}

export function analyze(board: Board, tiles: ArrayLike<number>): Analysis {
  const size = board.w * board.h;
  const owner = new Int8Array(size).fill(UNPOWERED);
  const loopArms = new Uint8Array(size);
  const comp = new Int32Array(size).fill(-1);
  const sourceColor = new Int8Array(size).fill(-1);
  board.sources.forEach((s, k) => (sourceColor[s] = k));

  let solved = true;
  let ncomp = 0;
  for (let start = 0; start < size; start++) {
    if (comp[start] >= 0) continue;
    const members = [start];
    comp[start] = ncomp;
    let colour = -1;
    let nsources = 0;
    for (let q = 0; q < members.length; q++) {
      const i = members[q];
      if (sourceColor[i] >= 0) {
        colour = sourceColor[i];
        nsources++;
      }
      for (const d of DIRS) {
        if (!(tiles[i] & d)) continue;
        const n = matched(board, tiles, i, d);
        if (n < 0) {
          solved = false;
          continue;
        }
        if (comp[n] < 0) {
          comp[n] = ncomp;
          members.push(n);
        }
      }
    }
    const state = nsources === 0 ? UNPOWERED : nsources === 1 ? colour : SHORT_CIRCUIT;
    if (nsources !== 1) solved = false;
    for (const i of members) owner[i] = state;
    ncomp++;
  }

  // An edge is on a loop iff its endpoints stay connected without it. The
  // grids are small enough that a BFS per edge is cheaper than being clever.
  for (let i = 0; i < size; i++) {
    for (const d of [R, D]) {
      const n = matched(board, tiles, i, d);
      if (n < 0 || !reachableWithout(board, tiles, i, d, n)) continue;
      loopArms[i] |= d;
      loopArms[n] |= opposite(d);
      solved = false;
    }
  }

  return { owner, loopArms, solved };
}

function reachableWithout(
  board: Board,
  tiles: ArrayLike<number>,
  from: number,
  cutDir: number,
  to: number,
): boolean {
  const seen = new Uint8Array(board.w * board.h);
  const stack = [from];
  seen[from] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    for (const d of DIRS) {
      if (i === from && d === cutDir) continue;
      const n = matched(board, tiles, i, d);
      if (n < 0) continue;
      if (n === from && i === to && d === opposite(cutDir)) continue;
      if (n === to) return true;
      if (!seen[n]) {
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return false;
}

// ─── Solver ─────────────────────────────────────────────────────────────────
// Each tile keeps a 16-bit mask of the tile values it may still take.
const HAS = DIRS.reduce<Record<number, number>>((acc, d) => {
  let m = 0;
  for (let v = 0; v < 16; v++) if (v & d) m |= 1 << v;
  acc[d] = m;
  return acc;
}, {});
const LACKS = (d: number) => ~HAS[d] & 0xffff;

function rotationsMask(v: number): number {
  let m = 0;
  for (let t = 0; t < 4; t++) m |= 1 << rotateCWBy(v, t);
  return m;
}

/** Candidates eliminated by each global rule while deducing. */
export interface RuleTally {
  /** Would close a loop. */
  loop: number;
  /** Would join two sources. */
  short: number;
  /** Would seal off a group with no source, or strand the rest of the grid without one. */
  sealed: number;
}

export interface SolveStats {
  /** Solved by deduction alone, without trial and error. */
  deducible: boolean;
  /** Share of tiles fixed by purely local edge matching before any global rule. */
  localShare: number;
  /** Simultaneous deduction passes until fixed: roughly the length of the reasoning chain. */
  waves: number;
  rules: RuleTally;
}

export interface SolveResult {
  /** Number of solutions found, capped at the requested limit. */
  solutions: number;
  stats: SolveStats;
  /** The first solution found, as tile values. */
  solution?: number[];
}

class Solver {
  readonly board: Board;
  readonly size: number;
  readonly nbr: Int32Array;
  readonly isSource: Uint8Array;

  // No parameter properties: they are not erasable syntax (see file header).
  constructor(board: Board) {
    this.board = board;
    this.size = board.w * board.h;
    this.nbr = new Int32Array(this.size * 4);
    for (let i = 0; i < this.size; i++) {
      DIRS.forEach((d, k) => (this.nbr[i * 4 + k] = neighbor(board, i, d)));
    }
    this.isSource = new Uint8Array(this.size);
    for (const s of board.sources) this.isSource[s] = 1;
  }

  n(i: number, k: number): number {
    return this.nbr[i * 4 + k];
  }

  /** Whether value `v` at tile `i` can still meet the neighbours' candidates on every edge. */
  fits(cand: Uint16Array, i: number, v: number): boolean {
    for (let k = 0; k < 4; k++) {
      const d = DIRS[k];
      const n = this.n(i, k);
      const back = opposite(d);
      const ok =
        v & d ? n >= 0 && (cand[n] & HAS[back]) !== 0 : n < 0 || (cand[n] & LACKS(back)) !== 0;
      if (!ok) return false;
    }
    return true;
  }

  /** Local arc consistency: every candidate's arms must be matchable by the neighbours. */
  matchEdges(cand: Uint16Array): boolean {
    const queue: number[] = [];
    const queued = new Uint8Array(this.size).fill(1);
    for (let i = 0; i < this.size; i++) queue.push(i);
    while (queue.length) {
      const i = queue.shift()!;
      queued[i] = 0;
      let keep = cand[i];
      for (let v = 0; v < 16; v++) {
        if (keep & (1 << v) && !this.fits(cand, i, v)) keep &= ~(1 << v);
      }
      if (keep === cand[i]) continue;
      if (!keep) return false;
      cand[i] = keep;
      for (let k = 0; k < 4; k++) {
        const n = this.n(i, k);
        if (n >= 0 && !queued[n]) {
          queued[n] = 1;
          queue.push(n);
        }
      }
    }
    return true;
  }

  /**
   * Global rules over the definitely-connected forest. A candidate is ruled
   * out if fixing it would close a loop, join two sources, or seal off a
   * group with no source (or leave the rest of the grid without one).
   * Returns the number of eliminations, or -1 on contradiction.
   */
  globalRules(cand: Uint16Array, tally: RuleTally | null): number {
    const { size } = this;
    const nsources = this.board.sources.length;
    const definite = (i: number, d: number) => (cand[i] & LACKS(d)) === 0;
    const unknown = (i: number, d: number) =>
      (cand[i] & HAS[d]) !== 0 && (cand[i] & LACKS(d)) !== 0;

    const parent = new Int32Array(size);
    for (let i = 0; i < size; i++) parent[i] = i;
    const find = (i: number): number => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]];
      return i;
    };
    // R and D visit every edge exactly once, including wrapped ones.
    for (let i = 0; i < size; i++) {
      for (const k of [0, 3]) {
        if (!definite(i, DIRS[k])) continue;
        const a = find(i);
        const b = find(this.n(i, k));
        if (a === b) return -1;
        parent[a] = b;
      }
    }

    const root = new Int32Array(size);
    const members: number[][] = Array.from({ length: size }, () => []);
    const srcCount = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      root[i] = find(i);
      members[root[i]].push(i);
      srcCount[root[i]] += this.isSource[i];
    }

    const inSet = new Uint8Array(size);
    // Outlets of the union `roots`, ignoring edges at `pinned` (whose state is being fixed).
    const hasOutlet = (roots: number[], pinned: number) => {
      for (const r of roots) inSet[r] = 1;
      let found = false;
      outer: for (const r of roots) {
        for (const m of members[r]) {
          if (m === pinned) continue;
          for (let k = 0; k < 4; k++) {
            if (!unknown(m, DIRS[k])) continue;
            const n = this.n(m, k);
            if (n === pinned || inSet[root[n]]) continue;
            found = true;
            break outer;
          }
        }
      }
      for (const r of roots) inSet[r] = 0;
      return found;
    };
    const sealedBadly = (roots: number[], pinned: number) => {
      if (hasOutlet(roots, pinned)) return false;
      let s = 0;
      let n = 0;
      for (const r of roots) {
        s += srcCount[r];
        n += members[r].length;
      }
      return s === 0 || (n < size && s === nsources);
    };

    for (let r = 0; r < size; r++) {
      if (root[r] !== r) continue;
      if (srcCount[r] > 1 || sealedBadly([r], -1)) return -1;
    }

    const removals: Array<[number, number]> = [];
    for (let t = 0; t < size; t++) {
      if (popcount(cand[t]) < 2) continue;
      let remaining = cand[t];
      for (let v = 0; v < 16; v++) {
        if (!(cand[t] & (1 << v))) continue;
        const rule = this.refute(cand, t, v, root, members, srcCount);
        if (rule) {
          remaining &= ~(1 << v);
          if (tally) tally[rule]++;
        }
      }
      if (!remaining) return -1;
      if (remaining !== cand[t]) removals.push([t, remaining]);
    }
    // Applied afterwards: the checks above assume the forest computed from the
    // candidates as they were at the start of the pass.
    let elims = 0;
    for (const [t, m] of removals) {
      elims += popcount(cand[t]) - popcount(m);
      cand[t] = m;
    }
    return elims;
  }

  /**
   * Tests one hypothesis "tile t takes value v" against the global rules.
   * The hypothesis also pins each neighbour's facing edge, and those
   * neighbours are looked at with that restriction applied: this is the
   * step a player takes when they see that pointing two dead ends at each
   * other would seal both off.
   */
  refute(
    cand: Uint16Array,
    t: number,
    v: number,
    root: Int32Array,
    members: number[][],
    srcCount: Int32Array,
  ): keyof RuleTally | null {
    const { size } = this;
    const nsources = this.board.sources.length;

    const touched = [t];
    const override = new Map<number, number>([[t, 1 << v]]);
    for (let k = 0; k < 4; k++) {
      const n = this.n(t, k);
      if (n < 0 || n === t) continue;
      const back = opposite(DIRS[k]);
      const m = (override.get(n) ?? cand[n]) & (v & DIRS[k] ? HAS[back] : LACKS(back));
      // Local matching has already removed any v that leaves a neighbour empty.
      if (!m) return "loop";
      override.set(n, m);
      if (!touched.includes(n)) touched.push(n);
    }
    const mask = (i: number) => override.get(i) ?? cand[i];

    // Union the forest's components along edges the hypothesis newly forces.
    const up = new Map<number, number>();
    const find = (r: number): number => {
      for (let p = up.get(r); p !== undefined; p = up.get(r)) r = p;
      return r;
    };
    const seenEdge = new Set<number>();
    for (const i of touched) {
      for (let k = 0; k < 4; k++) {
        const d = DIRS[k];
        const n = this.n(i, k);
        if (n < 0 || (mask(i) & LACKS(d)) !== 0 || (cand[i] & LACKS(d)) === 0) continue;
        const key = i < n ? i * 4 + k : n * 4 + ((k + 2) & 3);
        if (seenEdge.has(key)) continue;
        seenEdge.add(key);
        const a = find(root[i]);
        const b = find(root[n]);
        if (a === b) return "loop";
        up.set(a, b);
      }
    }

    // Every merged group the hypothesis touched, as its list of forest roots.
    const groups = new Map<number, number[]>();
    for (const i of touched) groups.set(find(root[i]), []);
    for (const r of [...up.keys(), ...groups.keys()]) {
      const list = groups.get(find(r));
      if (list && !list.includes(r)) list.push(r);
    }

    for (const [g, roots] of groups) {
      let sources = 0;
      let tiles = 0;
      for (const r of roots) {
        sources += srcCount[r];
        tiles += members[r].length;
      }
      if (sources > 1) return "short";
      let outlet = false;
      search: for (const r of roots) {
        for (const m of members[r]) {
          for (let k = 0; k < 4; k++) {
            const d = DIRS[k];
            const n = this.n(m, k);
            if (n < 0 || find(root[n]) === g) continue;
            if (mask(m) & HAS[d] && mask(n) & HAS[opposite(d)]) {
              outlet = true;
              break search;
            }
          }
        }
      }
      if (!outlet && (sources === 0 || (sources === nsources && tiles < size))) return "sealed";
    }
    return null;
  }

  /**
   * One simultaneous pass of local matching over every tile, judged against
   * the candidates as they stood at the start of the pass. Counting passes
   * approximates how long the player's chain of deductions is.
   */
  localWave(cand: Uint16Array): number {
    const next = cand.slice();
    let elims = 0;
    for (let i = 0; i < this.size; i++) {
      for (let v = 0; v < 16; v++) {
        if (cand[i] & (1 << v) && !this.fits(cand, i, v)) {
          next[i] &= ~(1 << v);
          elims++;
        }
      }
      if (!next[i]) return -1;
    }
    cand.set(next);
    return elims;
  }

  /** Deduction in waves (local first, global only when stuck); returns the wave count or -1. */
  measure(cand: Uint16Array, tally: RuleTally): number {
    let waves = 0;
    for (;;) {
      let elims = this.localWave(cand);
      if (elims < 0) return -1;
      if (elims === 0) {
        elims = this.globalRules(cand, tally);
        if (elims < 0) return -1;
        if (elims === 0) return waves;
      }
      waves++;
    }
  }

  propagate(cand: Uint16Array): boolean {
    for (;;) {
      if (!this.matchEdges(cand)) return false;
      const elims = this.globalRules(cand, null);
      if (elims < 0) return false;
      if (elims === 0) return true;
    }
  }

  search(cand: Uint16Array, limit: number, found: Uint16Array[]): number {
    if (!this.propagate(cand)) return 0;
    let best = -1;
    for (let i = 0; i < this.size; i++) {
      const c = popcount(cand[i]);
      if (c > 1 && (best < 0 || c < popcount(cand[best]))) best = i;
    }
    if (best < 0) {
      found.push(cand);
      return 1;
    }
    let count = 0;
    for (let v = 0; v < 16 && count < limit; v++) {
      if (!(cand[best] & (1 << v))) continue;
      const next = cand.slice();
      next[best] = 1 << v;
      count += this.search(next, limit - count, found);
    }
    return count;
  }
}

/** Counts solutions (up to `limit`) for the tile shapes in `tiles`; orientation is ignored. */
export function solve(board: Board, tiles: ArrayLike<number>, limit = 2): SolveResult {
  const solver = new Solver(board);
  const size = board.w * board.h;
  const cand = new Uint16Array(size);
  for (let i = 0; i < size; i++) cand[i] = rotationsMask(tiles[i]);

  const local = cand.slice();
  const localShare = solver.matchEdges(local)
    ? Array.from(local).filter((m) => popcount(m) === 1).length / size
    : 0;

  const root = cand.slice();
  const rules: RuleTally = { loop: 0, short: 0, sealed: 0 };
  const waves = solver.measure(root, rules);
  const ok = waves >= 0;
  const deducible = ok && root.every((m) => popcount(m) === 1);
  const stats: SolveStats = { deducible, localShare, waves: Math.max(waves, 0), rules };

  const found: Uint16Array[] = [];
  const solutions = ok ? solver.search(root, limit, found) : 0;
  const solution = found[0] && Array.from(found[0], (m) => 31 - Math.clz32(m));
  return { solutions, stats, solution };
}

// ─── Generator ──────────────────────────────────────────────────────────────
export interface Rng {
  next(): number;
  int(n: number): number;
}

/** mulberry32: tiny, seedable, and identical on every JS engine. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}

export interface GenParams {
  w: number;
  h: number;
  colors: number;
  wrap: boolean;
  /** Share of solution-unused interior edges to wall off; walls only ever help the player. */
  barrierRate: number;
  /** Minimum Manhattan distance between sources. */
  sourceGap: number;
  /** Every tree must cover at least this many tiles. */
  minTree: number;
}

export interface Layout extends Board {
  solution: number[];
}

function pickSources(p: GenParams, rng: Rng): number[] | null {
  const { w, h } = p;
  if (p.colors === 1) return [Math.floor(h / 2) * w + Math.floor(w / 2)];
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked: number[] = [];
    for (let tries = 0; tries < 200 && picked.length < p.colors; tries++) {
      const c = rng.int(w * h);
      const far = picked.every((s) => {
        const dx = Math.abs((s % w) - (c % w));
        const dy = Math.abs(Math.floor(s / w) - Math.floor(c / w));
        const mx = p.wrap ? Math.min(dx, w - dx) : dx;
        const my = p.wrap ? Math.min(dy, h - dy) : dy;
        return mx + my >= p.sourceGap;
      });
      if (far) picked.push(c);
    }
    if (picked.length === p.colors) return picked;
  }
  return null;
}

/**
 * Grows one tree per source at once, net.c-style: repeatedly extend a random
 * tree into an unclaimed neighbour, never closing a loop and never creating a
 * four-way cross (crosses look the same in every orientation, so they would
 * be free tiles). Picking the tree first, then the step, keeps tree sizes
 * comparable instead of letting the first big tree swallow the board.
 */
export function generateLayout(p: GenParams, rng: Rng): Layout | null {
  const size = p.w * p.h;
  const sources = pickSources(p, rng);
  if (!sources) return null;
  const open: Board = { w: p.w, h: p.h, wrap: p.wrap, barriers: new Uint8Array(size), sources };
  const tiles = Array.from({ length: size }, () => 0);
  const owner = new Int32Array(size).fill(-1);
  const treeSize = new Int32Array(p.colors).fill(1);
  type Step = { i: number; d: number; tree: number };
  let steps: Step[] = [];

  const addSteps = (i: number, tree: number) => {
    for (const d of DIRS) {
      if (tiles[i] & d) continue;
      const n = neighbor(open, i, d);
      if (n >= 0 && owner[n] < 0) steps.push({ i, d, tree });
    }
  };
  sources.forEach((s, k) => (owner[s] = k));
  sources.forEach((s, k) => addSteps(s, k));

  while (steps.length) {
    const trees = [...new Set(steps.map((s) => s.tree))];
    const tree = trees[rng.int(trees.length)];
    const mine = steps.filter((s) => s.tree === tree);
    const { i, d } = mine[rng.int(mine.length)];
    const n = neighbor(open, i, d);

    tiles[i] |= d;
    tiles[n] |= opposite(d);
    owner[n] = tree;
    treeSize[tree]++;
    steps = steps.filter(
      (s) =>
        neighbor(open, s.i, s.d) !== n &&
        !(s.i === i && popcount(tiles[i]) === 3 && !(tiles[i] & s.d)),
    );
    addSteps(n, tree);
  }

  if (owner.some((o) => o < 0)) return null;
  if (treeSize.some((s) => s < p.minTree)) return null;

  const barriers = new Uint8Array(size);
  const walls: Array<[number, number]> = [];
  for (let i = 0; i < size; i++) {
    for (const d of [R, D]) {
      const n = neighbor(open, i, d);
      if (n >= 0 && !(tiles[i] & d)) walls.push([i, d]);
    }
  }
  let nwalls = Math.floor(p.barrierRate * walls.length);
  while (nwalls-- > 0) {
    const [i, d] = walls.splice(rng.int(walls.length), 1)[0];
    barriers[i] |= d;
    barriers[neighbor(open, i, d)] |= opposite(d);
  }

  return { w: p.w, h: p.h, wrap: p.wrap, barriers: Array.from(barriers), sources, solution: tiles };
}

/**
 * Scrambles a solved layout by random clockwise turns. The opening position
 * must not already show loops or short circuits (it would flag an error
 * before the player has done anything) and must leave most tiles to fix.
 */
export function scramble(layout: Layout, rng: Rng, maxCorrectShare: number): number[] | null {
  const size = layout.w * layout.h;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const tiles = layout.solution.map((v) => rotateCWBy(v, rng.int(4)));
    const correct = tiles.filter((v, i) => v === layout.solution[i]).length;
    if (correct / size > maxCorrectShare) continue;
    const a = analyze(layout, tiles);
    if (a.solved || a.loopArms.some(Boolean) || a.owner.some((o) => o === SHORT_CIRCUIT)) continue;
    return tiles;
  }
  return null;
}

/** Fewest clockwise turns to bring `from` onto `to` (same shape), or -1. */
export function turnsBetween(from: number, to: number): number {
  for (let t = 0; t < 4; t++) if (rotateCWBy(from, t) === to) return t;
  return -1;
}

// ─── Level encoding ─────────────────────────────────────────────────────────
const HEX = "0123456789abcdef";
export const encodeHex = (values: ArrayLike<number>) =>
  Array.from(values, (v) => HEX[v & 15]).join("");
export const decodeHex = (s: string) => Array.from(s, (c) => parseInt(c, 16));
