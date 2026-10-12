import { type Analysis, type Board, DIRS, neighbor, opposite } from "@/app/net/engine";

/** How current travels through the powered part of the board, for animation only. */
export interface Flow {
  /** Hops from the tile's source along the wires; -1 when not cleanly powered. */
  depth: Int16Array;
  /** Screen direction of the arm through which current reaches the tile; 0 at a source. */
  inlet: Uint8Array;
  maxDepth: number;
}

export function traceFlow(board: Board, tiles: ArrayLike<number>, analysis: Analysis): Flow {
  const size = board.w * board.h;
  const depth = new Int16Array(size).fill(-1);
  const inlet = new Uint8Array(size);
  let maxDepth = 0;
  board.sources.forEach((s, colour) => {
    // A short-circuited network has no single direction of flow; it only flickers.
    if (analysis.owner[s] !== colour) return;
    depth[s] = 0;
    const queue = [s];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      for (const d of DIRS) {
        if (!(tiles[i] & d)) continue;
        const n = neighbor(board, i, d);
        if (n < 0 || !(tiles[n] & opposite(d)) || depth[n] >= 0) continue;
        depth[n] = depth[i] + 1;
        inlet[n] = opposite(d);
        if (depth[n] > maxDepth) maxDepth = depth[n];
        queue.push(n);
      }
    }
  });
  return { depth, inlet, maxDepth };
}
