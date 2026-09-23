import type * as THREE from "three";
import type { GameAudio } from "./audio";
import type { HudState } from "./types";

export type HouseId = "home" | "cafe" | "library" | "bakery" | "flower" | "music" | "arcade" | "observatory";

export interface HouseDef {
  id: HouseId;
  name: string;
  sub: string;
  x: number;
  z: number;
  /** Rotation around Y; the door is on the local +Z face. */
  facing: number;
  w: number;
  d: number;
  wall: string;
  roof: string;
  trim: string;
  door: string;
  roofType: "gable" | "pyramid" | "dome" | "flat" | "tower";
  awning?: [string, string];
  chimney?: boolean;
  sign: string;
}

const S = 0;
const N = Math.PI;
const E = Math.PI / 2;
const W = -Math.PI / 2;

export const HOUSES: HouseDef[] = [
  { id: "home", name: "trudbot 的家", sub: "HOME", x: -18, z: -15, facing: S, w: 9, d: 8, wall: "#B5F5EC", roof: "#FF8FAB", trim: "#FF6B9D", door: "#5CE0D8", roofType: "gable", chimney: true, sign: "#FFFFFF" },
  { id: "cafe", name: "泡泡咖啡馆", sub: "BUBBLE CAFÉ", x: 18, z: -15, facing: S, w: 10, d: 8, wall: "#FFEAA7", roof: "#FFA94D", trim: "#d97a2b", door: "#8a5a3c", roofType: "gable", awning: ["#FFA94D", "#fffaf0"], chimney: true, sign: "#FFD166" },
  { id: "library", name: "星空图书馆", sub: "LIBRARY", x: 0, z: -38, facing: S, w: 13, d: 9, wall: "#C4B5FD", roof: "#818CF8", trim: "#6366c9", door: "#4c4f9a", roofType: "gable", sign: "#EDE9FE" },
  { id: "bakery", name: "甜甜面包房", sub: "BAKERY", x: -18, z: 15, facing: N, w: 9, d: 9, wall: "#FFC4D6", roof: "#FF6B9D", trim: "#e0507f", door: "#b5476e", roofType: "dome", awning: ["#FF8FAB", "#fffaf0"], sign: "#FFF1F5" },
  { id: "flower", name: "花花花店", sub: "FLOWERS", x: 18, z: 15, facing: N, w: 9, d: 8, wall: "#fdf6ec", roof: "#7DFFC7", trim: "#2fbf8a", door: "#2fa57c", roofType: "gable", awning: ["#7DFFC7", "#fffaf0"], sign: "#E6FFF5" },
  { id: "music", name: "音乐小屋", sub: "MUSIC", x: 0, z: 38, facing: N, w: 10, d: 9, wall: "#7DD3FC", roof: "#A78BFA", trim: "#7c5ce0", door: "#5b3fb8", roofType: "pyramid", sign: "#F5F3FF" },
  { id: "arcade", name: "像素游戏厅", sub: "ARCADE", x: -38, z: 0, facing: E, w: 11, d: 9, wall: "#4c4f9a", roof: "#2e3066", trim: "#FF6B9D", door: "#5CE0D8", roofType: "flat", sign: "#1c1d3a" },
  { id: "observatory", name: "观星台", sub: "OBSERVATORY", x: 38, z: 0, facing: W, w: 9, d: 9, wall: "#f3f0ff", roof: "#A5F3FC", trim: "#818CF8", door: "#818CF8", roofType: "tower", sign: "#EEF2FF" },
];

export interface GameContext {
  audio: GameAudio;
  say(title: string, pages: string[]): void;
  toast(text: string): void;
  isNight(): boolean;
  setNight(night: boolean): void;
  enterHouse(id: HouseId): void;
  exitHouse(): void;
  boost(seconds: number): void;
  grow(seconds: number): void;
  holdFlower(color: string): void;
  dance(seconds: number): void;
  playerPosition(): THREE.Vector3;
  /** Fades the screen out, runs `fn` while covered, then fades back in. */
  fadeThrough(fn: () => void): void;
  /** Throws the character upwards, e.g. off a spring. */
  launch(vy: number): void;
  /** Places the character instantly; wrap in `fadeThrough` to hide the cut. */
  teleport(x: number, y: number, z: number, facing: number): void;
  hud(patch: Partial<HudState>): void;
}
