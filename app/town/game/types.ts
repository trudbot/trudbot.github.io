export interface HudState {
  location: string;
  indoor: boolean;
  prompt: string | null;
  stars: number;
  totalStars: number;
  night: boolean;
  muted: boolean;
  /** Seconds left on the café speed boost; 0 when inactive. */
  boost: number;
  /** Seconds left on the bakery growth effect; 0 when inactive. */
  grow: number;
  /** Whether the character is at the sky-hop course, which shows its readout. */
  hop: boolean;
  /** Height above the ground, in whole metres. */
  hopHeight: number;
  hopGoal: number;
  /** Elapsed time of the current climb in tenths of a second; null when not climbing. */
  hopTime: number | null;
  /** Fastest unassisted climb in tenths of a second. */
  hopBest: number | null;
  hopCheckpoint: number;
  hopCheckpoints: number;
}

export interface DialogState {
  title: string;
  text: string;
  page: number;
  pages: number;
}

export interface GameCallbacks {
  onHud(patch: Partial<HudState>): void;
  onDialog(dialog: DialogState | null): void;
  onFade(covered: boolean): void;
  onToast(text: string): void;
}

export type ActionKey = "jump" | "interact" | "wave" | "dance" | "night" | "mute";
