import type { MartialArtId } from "./types";

export interface MartialProficiencyRank {
  label: "初窥" | "架势" | "得法" | "宗成";
  level: number;
  nextAt: number | null;
  scale: number;
}

export interface MartialProficiencyTuning {
  attackDamageMultiplier: number;
  attackCooldownMultiplier: number;
  techniquePowerMultiplier: number;
  techniqueCooldownMultiplier: number;
  techniqueRangeBonus: number;
  controlBonus: number;
  specialistMultiplier: number;
  extraTargets: number;
}

const MARTIAL_IDS: MartialArtId[] = ["guard-spear", "severing-sabre", "binding-hands"];

export function createMartialProficiencyExperience(): Record<MartialArtId, number> {
  return { "guard-spear": 0, "severing-sabre": 0, "binding-hands": 0 };
}

export function normalizeMartialProficiencyExperience(value: unknown): Record<MartialArtId, number> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(MARTIAL_IDS.map((id) => [id, typeof source[id] === "number" ? Math.max(0, Math.floor(source[id])) : 0])) as Record<MartialArtId, number>;
}

export function martialProficiencyRank(experience: number): MartialProficiencyRank {
  const value = Math.max(0, Math.floor(experience));
  if (value >= 15) return { label: "宗成", level: 3, nextAt: null, scale: 1 };
  if (value >= 8) return { label: "得法", level: 2, nextAt: 15, scale: .67 };
  if (value >= 3) return { label: "架势", level: 1, nextAt: 8, scale: .34 };
  return { label: "初窥", level: 0, nextAt: 3, scale: 0 };
}

export function martialProficiencyTuning(id: MartialArtId, experience: number): MartialProficiencyTuning {
  const rank = martialProficiencyRank(experience);
  const level = rank.level;
  return {
    attackDamageMultiplier: 1 + level * .035,
    attackCooldownMultiplier: 1 - level * .025,
    techniquePowerMultiplier: 1 + level * .06,
    techniqueCooldownMultiplier: 1 - level * .04,
    techniqueRangeBonus: id === "severing-sabre" ? level * 10 : id === "guard-spear" ? level * 7 : level * 5,
    controlBonus: id === "binding-hands" ? level * .42 : id === "guard-spear" ? level * .14 : level * .08,
    specialistMultiplier: id === "severing-sabre" ? 1 + level * .09 : 1,
    extraTargets: id === "binding-hands" ? Math.floor((level + 1) / 2) : 0,
  };
}

export function martialProficiencyExperienceGain(techniqueCount: number, enemyLeaderDefeated: boolean): number {
  if (techniqueCount <= 0) return 0;
  return 1 + Number(techniqueCount >= 2) + Number(techniqueCount >= 4) + Number(enemyLeaderDefeated);
}

export function martialProficiencyEffectSummary(id: MartialArtId, experience: number): string {
  const tuning = martialProficiencyTuning(id, experience);
  const base = `普攻 +${Math.round((tuning.attackDamageMultiplier - 1) * 100)}% · 绝技 +${Math.round((tuning.techniquePowerMultiplier - 1) * 100)}% · 回转 -${Math.round((1 - tuning.techniqueCooldownMultiplier) * 100)}%`;
  if (id === "guard-spear") return `${base} · 拒马范围 +${tuning.techniqueRangeBonus}`;
  if (id === "severing-sabre") return `${base} · 斩专手 +${Math.round((tuning.specialistMultiplier - 1) * 100)}%`;
  return `${base} · 制敌 +${tuning.controlBonus.toFixed(1)}息${tuning.extraTargets ? ` · 多擒 ${tuning.extraTargets}人` : ""}`;
}
