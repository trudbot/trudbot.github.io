/*
 * Scene registry: every level's `id` in config maps to the world that stages
 * it, so adding a theme means one config entry and one factory here.
 */
import type { SceneId } from "../game/config.ts";
import { CanyonWorld } from "./canyon.ts";
import type { World } from "./common.ts";
import { CosmosWorld } from "./cosmos.ts";
import { PotsWorld, PotWorld } from "./courtyard.ts";
import { EarthWorld } from "./earth.ts";
import { EndingWorld } from "./ending.ts";
import { ValleyWorld } from "./valley.ts";

export const WORLDS: Record<SceneId | "ending", () => World> = {
  pot: () => new PotWorld(),
  pots: () => new PotsWorld(),
  boulder: () => new CanyonWorld(),
  mountain: () => new ValleyWorld(),
  earth: () => new EarthWorld(),
  cosmos: () => new CosmosWorld(),
  ending: () => new EndingWorld(),
};
