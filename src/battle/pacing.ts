import type { BattleAttackIntent } from "./simulation";

export type BattlePace = "deliberate" | "standard" | "rapid";

export interface BattlePaceOption {
  id: BattlePace;
  label: string;
  seal: string;
  description: string;
  multiplier: number;
}

export const BATTLE_PACE_OPTIONS: readonly BattlePaceOption[] = [
  { id: "deliberate", label: "审势", seal: "缓", description: "从容观察阵势", multiplier: .72 },
  { id: "standard", label: "常阵", seal: "常", description: "按正常节奏交锋", multiplier: 1 },
  { id: "rapid", label: "疾战", seal: "疾", description: "加快寻敌与交锋", multiplier: 1.45 },
] as const;

export interface BattlePacingState {
  timeScale: number;
  dangerFocus: boolean;
}

export function battlePaceMultiplier(pace: BattlePace): number {
  return BATTLE_PACE_OPTIONS.find((option) => option.id === pace)?.multiplier ?? 1;
}

export function battlePacingState(pace: BattlePace, intent: BattleAttackIntent | null, paused: boolean): BattlePacingState {
  if (paused) return { timeScale: 0, dangerFocus: false };
  const dangerFocus = Boolean(intent && intent.recommendedStrategy !== "breakthrough");
  const requestedScale = battlePaceMultiplier(pace);
  return {
    timeScale: dangerFocus ? Math.min(requestedScale, .5) : requestedScale,
    dangerFocus,
  };
}
