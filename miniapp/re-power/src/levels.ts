import { type Board, decodeHex } from "@/app/net/engine";
import levelData from "@/app/net/levels.json";

export interface Level extends Board {
  index: number;
  kind: "lesson" | "final";
  name: string;
  /** What this level adds; every earlier rule still applies. */
  lesson: string;
  /** Opening orientation; fixed so every player starts from the same position. */
  base: number[];
}

// Ranked boards are keyed by level position, so the level set is effectively
// frozen once boards hold scores: changing a level would mix runs of two
// different puzzles on one board.
export const LEVELS: Level[] = levelData.map((l, index) => ({
  ...l,
  index,
  kind: l.kind === "final" ? "final" : "lesson",
  barriers: decodeHex(l.barriers),
  base: decodeHex(l.tiles),
}));

const LESSON_COUNT = LEVELS.filter((l) => l.kind === "lesson").length;

export const levelNo = (i: number) => String(i + 1).padStart(2, "0");

export const badge = (level: Level) =>
  level.kind === "final" ? "实战关" : `教学关 ${level.index + 1}/${LESSON_COUNT}`;

/** Source colours, indexed by source: lab-green, warning-amber and coolant-cyan. */
export const SOURCE_COLORS = ["#8BFF5A", "#FFB43A", "#4FE3FF"];
export const SHORT_COLOR = "#FF3B3B";
