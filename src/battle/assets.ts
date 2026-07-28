import type { Enemy } from "./simulation";
import type { BattleConfig } from "../core/types";

const assetPath = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;

export const BATTLE_ASSETS = {
  convoy: { key: "battle-convoy", path: assetPath("battle/convoy-cart-v1.png") },
  client: { key: "battle-escort-client", path: assetPath("battle/clients/song-traveler-v1.png") },
  backgrounds: {
    official: { key: "battle-official-background", path: assetPath("battle/official-road-bg-v1.png") },
    mountain: { key: "battle-mountain-background", path: assetPath("battle/mountain-pass-bg-v1.png") },
    river: { key: "battle-river-background", path: assetPath("battle/river-ferry-bg-v1.png") },
  },
  leader: [1, 2, 3, 4].map((frame) => ({ key: `battle-leader-${frame}`, path: assetPath(`battle/leader/0${frame}.png`) })),
  guards: [1, 2, 3].map((frame) => ({ key: `battle-guard-${frame}`, path: assetPath(`battle/guards/0${frame}.png`) })),
  enemies: [1, 2, 3, 4].map((frame) => ({ key: `battle-enemy-${frame}`, path: assetPath(`battle/enemies/0${frame}.png`) })),
  chief: { key: "battle-enemy-leader", path: assetPath("battle/enemies/bandit-chief-v1.png") },
} as const;

export function battleBackgroundAsset(terrain: BattleConfig["terrain"]) {
  return BATTLE_ASSETS.backgrounds[terrain];
}

export function enemyTextureKey(type: Enemy["type"]): string {
  if (type === "leader") return BATTLE_ASSETS.chief.key;
  if (type === "archer") return "battle-enemy-2";
  if (type === "hooker" || type === "boarder") return "battle-enemy-3";
  if (type === "torch") return "battle-enemy-4";
  return "battle-enemy-1";
}
