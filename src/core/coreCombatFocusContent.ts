import type { CoreCombatFocusId } from "./types";

export interface CoreCombatFocusRank {
  label: "试锋" | "入门" | "纯熟" | "合璧";
  level: number;
  nextAt: number | null;
  scale: number;
}

export interface CoreCombatFocusModifiers {
  comboCooldownMultiplier: number;
  comboDamageMultiplier: number;
  comboAssistRange: number;
  counterIncomingMultiplier: number;
  counterDamageMultiplier: number;
  counterStunBonus: number;
  eliteDamageMultiplier: number;
  elitePriorityBonus: number;
  techniqueCooldownMultiplier: number;
}

export interface CoreCombatFocusDefinition {
  id: CoreCombatFocusId;
  name: string;
  seal: string;
  motto: string;
  description: string;
  growthHint: string;
}

export const DEFAULT_CORE_COMBAT_FOCUS: CoreCombatFocusId = "paired-assault";

export const CORE_COMBAT_FOCUSES: Record<CoreCombatFocusId, CoreCombatFocusDefinition> = {
  "paired-assault": {
    id: "paired-assault",
    name: "双锋破阵",
    seal: "破",
    motto: "主攻副承，一息两击",
    description: "总镖头制造破绽，副镖头立即接势；专精越深，自动合击越远、越快、越重。",
    growthHint: "自动合击次数越多，战后所得武路经验越高",
  },
  "cross-guard": {
    id: "cross-guard",
    name: "交锋截阵",
    seal: "截",
    motto: "双刃交错，替阵截锋",
    description: "两位主战核心交叉承受重击并立刻反制；专精越深，截锋减伤、反击与震慑越强。",
    growthHint: "成功截下匪首重招会加快武路成长",
  },
  "leader-hunt": {
    id: "leader-hunt",
    name: "追首夺魁",
    seal: "首",
    motto: "擒贼先王，锐锋逐首",
    description: "总镖头优先追击匪首与劫车能手，副镖头随势夹攻；专精越深，斩将伤害与绝技回转越强。",
    growthHint: "亲斩强敌、击溃匪首会获得更多武路经验",
  },
};

export const CORE_COMBAT_FOCUS_LIST = Object.values(CORE_COMBAT_FOCUSES);

export function coreCombatFocusRank(experience: number): CoreCombatFocusRank {
  const safe = Math.max(0, Math.floor(experience));
  if (safe >= 18) return { label: "合璧", level: 3, nextAt: null, scale: 1 };
  if (safe >= 10) return { label: "纯熟", level: 2, nextAt: 18, scale: .78 };
  if (safe >= 4) return { label: "入门", level: 1, nextAt: 10, scale: .56 };
  return { label: "试锋", level: 0, nextAt: 4, scale: .34 };
}

export function coreCombatFocusTuning(id: CoreCombatFocusId = DEFAULT_CORE_COMBAT_FOCUS, experience = 0): CoreCombatFocusModifiers {
  const scale = coreCombatFocusRank(experience).scale;
  const neutral: CoreCombatFocusModifiers = {
    comboCooldownMultiplier: 1,
    comboDamageMultiplier: 1,
    comboAssistRange: 285,
    counterIncomingMultiplier: 1,
    counterDamageMultiplier: 1,
    counterStunBonus: 0,
    eliteDamageMultiplier: 1,
    elitePriorityBonus: 0,
    techniqueCooldownMultiplier: 1,
  };
  if (id === "paired-assault") return {
    ...neutral,
    comboCooldownMultiplier: 1 - .18 * scale,
    comboDamageMultiplier: 1 + .24 * scale,
    comboAssistRange: 285 + 70 * scale,
  };
  if (id === "cross-guard") return {
    ...neutral,
    counterIncomingMultiplier: 1 - .22 * scale,
    counterDamageMultiplier: 1 + .26 * scale,
    counterStunBonus: .32 * scale,
  };
  return {
    ...neutral,
    eliteDamageMultiplier: 1 + .22 * scale,
    elitePriorityBonus: 150 * scale,
    techniqueCooldownMultiplier: 1 - .16 * scale,
  };
}

export function coreCombatFocusEffectSummary(id: CoreCombatFocusId, experience: number): string {
  const tuning = coreCombatFocusTuning(id, experience);
  if (id === "paired-assault") return `合击伤害 +${Math.round((tuning.comboDamageMultiplier - 1) * 100)}% · 回转 -${Math.round((1 - tuning.comboCooldownMultiplier) * 100)}% · 接势 +${Math.round(tuning.comboAssistRange - 285)}步`;
  if (id === "cross-guard") return `截锋受创 -${Math.round((1 - tuning.counterIncomingMultiplier) * 100)}% · 反击 +${Math.round((tuning.counterDamageMultiplier - 1) * 100)}% · 震慑 +${tuning.counterStunBonus.toFixed(1)}息`;
  return `斩将伤害 +${Math.round((tuning.eliteDamageMultiplier - 1) * 100)}% · 绝技回转 -${Math.round((1 - tuning.techniqueCooldownMultiplier) * 100)}%`;
}

export function coreCombatExperienceGain(
  id: CoreCombatFocusId,
  record: { combos?: number; counters?: number; leaderDefeated?: boolean; leaderDefeats?: number },
): number {
  if (id === "paired-assault") return 1 + Number((record.combos ?? 0) >= 1) + Number((record.combos ?? 0) >= 3);
  if (id === "cross-guard") return 1 + Number((record.counters ?? 0) >= 1) + Number((record.counters ?? 0) >= 2);
  return 1 + Number((record.leaderDefeats ?? 0) >= 1) + Number(record.leaderDefeated);
}

export function createCoreCombatExperience(): Record<CoreCombatFocusId, number> {
  return { "paired-assault": 0, "cross-guard": 0, "leader-hunt": 0 };
}

export function normalizeCoreCombatExperience(value: unknown): Record<CoreCombatFocusId, number> {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result = createCoreCombatExperience();
  for (const id of Object.keys(result) as CoreCombatFocusId[]) {
    const experience = source[id];
    if (typeof experience === "number" && Number.isFinite(experience)) result[id] = Math.max(0, Math.floor(experience));
  }
  return result;
}
