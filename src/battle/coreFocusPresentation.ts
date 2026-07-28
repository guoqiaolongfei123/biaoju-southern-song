import { CORE_COMBAT_FOCUSES, DEFAULT_CORE_COMBAT_FOCUS } from "../core/coreCombatFocusContent";
import type { CoreCombatFocusId } from "../core/types";

export type BattleCoreFocusChoreography = "cross" | "ward" | "hunt";

export interface BattleCoreFocusVisual {
  id: CoreCombatFocusId;
  name: string;
  seal: string;
  choreography: BattleCoreFocusChoreography;
  primary: number;
  secondary: number;
  highlight: number;
  panel: number;
  edge: number;
  cssClass: string;
  slashAngles: readonly [number, number];
  cameraShake: number;
}

const VISUALS: Record<CoreCombatFocusId, Omit<BattleCoreFocusVisual, "id" | "name" | "seal">> = {
  "paired-assault": {
    choreography: "cross",
    primary: 0xe4b35f,
    secondary: 0xc8523e,
    highlight: 0xf7e5b0,
    panel: 0x47231b,
    edge: 0xb1533e,
    cssClass: "focus-paired-assault",
    slashAngles: [-31, 34],
    cameraShake: .0039,
  },
  "cross-guard": {
    choreography: "ward",
    primary: 0x9fc194,
    secondary: 0xd6ae62,
    highlight: 0xe6e4b5,
    panel: 0x20372a,
    edge: 0x5f936e,
    cssClass: "focus-cross-guard",
    slashAngles: [-12, 16],
    cameraShake: .0026,
  },
  "leader-hunt": {
    choreography: "hunt",
    primary: 0xe4bd6c,
    secondary: 0xb83f31,
    highlight: 0xf5d99a,
    panel: 0x4a1d18,
    edge: 0xa63c30,
    cssClass: "focus-leader-hunt",
    slashAngles: [-48, -8],
    cameraShake: .0046,
  },
};

export function battleCoreFocusVisual(id: CoreCombatFocusId = DEFAULT_CORE_COMBAT_FOCUS): BattleCoreFocusVisual {
  const definition = CORE_COMBAT_FOCUSES[id] ?? CORE_COMBAT_FOCUSES[DEFAULT_CORE_COMBAT_FOCUS];
  return { id: definition.id, name: definition.name, seal: definition.seal, ...VISUALS[definition.id] };
}

export function battleCoreFocusMomentDetail(id: CoreCombatFocusId, amount: number, counter = false): string {
  const value = Math.max(1, Math.round(amount));
  if (id === "cross-guard") return counter ? `双弧卸力后交叉还击 · 反势 ${value}` : `副镖头回身封线，总镖头顺势补锋 · 合势 ${value}`;
  if (id === "leader-hunt") return counter ? `让开来锋后直取敌首 · 反势 ${value}` : `锁定匪首与劫车能手，双锋同逐 · 合势 ${value}`;
  return counter ? `双刃交错截住重招 · 反势 ${value}` : `主攻副承，一息两击 · 合势 ${value}`;
}
