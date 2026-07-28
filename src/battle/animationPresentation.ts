import { coreCombatFocusRank } from "../core/coreCombatFocusContent";
import type { CoreCombatFocusId } from "../core/types";

export type BattleDefeatWeight = "guard" | "raider" | "leader";

export interface BattleDefeatPose {
  progress: number;
  angle: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
}

export interface BattleHitPose {
  strength: number;
  offsetX: number;
  angle: number;
  scaleX: number;
  scaleY: number;
}

export interface BattleCoreComboTiming {
  approachMs: number;
  strikeGapMs: number;
  impactMs: number;
  settleMs: number;
  cameraZoom: number;
}

export function shouldReduceBattleMotion(search: string, systemPreference: boolean): boolean {
  return systemPreference || new URLSearchParams(search).get("reduced-motion") === "1";
}

const DEFEAT_DURATION: Record<BattleDefeatWeight, number> = {
  guard: .48,
  raider: .4,
  leader: .68,
};

const DEFEAT_ANGLE: Record<BattleDefeatWeight, number> = {
  guard: 72,
  raider: 80,
  leader: 66,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function directionSign(direction: number): number {
  return direction < 0 ? -1 : 1;
}

export function battleDefeatPose(elapsed: number, direction: number, weight: BattleDefeatWeight = "raider"): BattleDefeatPose {
  const progress = clamp01(elapsed / DEFEAT_DURATION[weight]);
  const eased = 1 - (1 - progress) ** 3;
  const settle = Math.sin(progress * Math.PI);
  const fade = progress <= .68 ? 1 : 1 - ((progress - .68) / .32) * .78;
  return {
    progress,
    angle: directionSign(direction) * DEFEAT_ANGLE[weight] * eased,
    offsetY: (weight === "leader" ? 15 : weight === "guard" ? 11 : 9) * eased,
    scaleX: 1 + settle * (weight === "leader" ? .1 : .07),
    scaleY: 1 - eased * (weight === "leader" ? .13 : .17),
    alpha: progress >= 1 ? .22 : Math.max(.22, fade),
  };
}

export function battleHitPose(flashRemaining: number, direction: number, maxFlash = .12): BattleHitPose {
  const strength = clamp01(flashRemaining / Math.max(.001, maxFlash));
  if (strength === 0) return { strength: 0, offsetX: 0, angle: 0, scaleX: 1, scaleY: 1 };
  const sign = directionSign(direction);
  return {
    strength,
    offsetX: -sign * 6 * strength,
    angle: -sign * 4.5 * strength,
    scaleX: 1 + strength * .075,
    scaleY: 1 - strength * .07,
  };
}

export function battleCoreComboTiming(
  leaderExperience = 0,
  deputyExperience = 0,
  bondExperience = 0,
  reducedMotion = false,
  focusId?: CoreCombatFocusId,
  focusExperience = 0,
): BattleCoreComboTiming {
  if (reducedMotion) return { approachMs: 0, strikeGapMs: 0, impactMs: 0, settleMs: 260, cameraZoom: 1 };
  const combinedExperience = Math.max(0, leaderExperience) + Math.max(0, deputyExperience);
  const focusScale = focusId ? coreCombatFocusRank(focusExperience).scale : 0;
  const pairedApproach = focusId === "paired-assault" ? 24 * focusScale : 0;
  const huntApproach = focusId === "leader-hunt" ? 42 * focusScale : 0;
  const guardApproach = focusId === "cross-guard" ? 18 * focusScale : 0;
  const focusStrikeGap = focusId === "paired-assault" ? 34 * focusScale : focusId === "cross-guard" ? 12 * focusScale : -10 * focusScale;
  const focusZoom = focusId === "leader-hunt" ? .012 * focusScale : focusId === "paired-assault" ? .007 * focusScale : .003 * focusScale;
  return {
    approachMs: Math.round(235 - Math.min(45, combinedExperience * 1.5) - pairedApproach - huntApproach + guardApproach),
    strikeGapMs: Math.round(135 - Math.min(62, Math.max(0, bondExperience) * 4.5) - focusStrikeGap),
    impactMs: focusId === "cross-guard" ? 230 : focusId === "leader-hunt" ? 150 : 180,
    settleMs: focusId === "cross-guard" ? 780 : focusId === "leader-hunt" ? 660 : 720,
    cameraZoom: 1.018 + Math.min(.012, combinedExperience * .00035) + focusZoom,
  };
}
