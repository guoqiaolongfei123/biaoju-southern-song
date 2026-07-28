import type { BattleFormationId } from "./types";

export interface FormationProficiencyDefinition {
  id: BattleFormationId;
  seal: string;
  name: string;
  motto: string;
  effect: string;
}

export const FORMATION_PROFICIENCIES: Record<BattleFormationId, FormationProficiencyDefinition> = {
  advance: { id: "advance", seal: "进", name: "雁行开路", motto: "趁隙越阵，快打快收", effect: "行进阵中提升攻势" },
  hold: { id: "hold", seal: "车", name: "围车结阵", motto: "人依车角，器械相援", effect: "守车阵中提升攻势与护车" },
  horses: { id: "horses", seal: "马", name: "夹辕护马", motto: "看缰守辔，不容近身", effect: "护马阵中提升攻势与护马" },
};

export const BATTLE_FORMATION_IDS: BattleFormationId[] = ["advance", "hold", "horses"];

export function createFormationExperience(): Record<BattleFormationId, number> {
  return { advance: 0, hold: 0, horses: 0 };
}

export function normalizeFormationExperience(value: unknown): Record<BattleFormationId, number> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(BATTLE_FORMATION_IDS.map((id) => [id, typeof source[id] === "number" ? Math.max(0, Math.floor(source[id] as number)) : 0])) as Record<BattleFormationId, number>;
}

export interface FormationProficiencyRank {
  label: "初识" | "熟阵" | "善阵" | "精阵";
  level: number;
  bonus: number;
  nextAt: number | null;
}

export function formationProficiencyRank(experience = 0): FormationProficiencyRank {
  if (experience >= 12) return { label: "精阵", level: 3, bonus: .09, nextAt: null };
  if (experience >= 7) return { label: "善阵", level: 2, bonus: .06, nextAt: 12 };
  if (experience >= 3) return { label: "熟阵", level: 1, bonus: .03, nextAt: 7 };
  return { label: "初识", level: 0, bonus: 0, nextAt: 3 };
}

export function formationExperienceAwards(seconds: Partial<Record<BattleFormationId, number>>): Partial<Record<BattleFormationId, number>> {
  const ranked = BATTLE_FORMATION_IDS
    .map((id) => ({ id, seconds: Math.max(0, seconds[id] ?? 0) }))
    .sort((a, b) => b.seconds - a.seconds || BATTLE_FORMATION_IDS.indexOf(a.id) - BATTLE_FORMATION_IDS.indexOf(b.id));
  const total = ranked.reduce((sum, item) => sum + item.seconds, 0);
  if (total <= 0 || ranked[0].seconds < 1) return {};
  const awards: Partial<Record<BattleFormationId, number>> = { [ranked[0].id]: 1 };
  const secondary = ranked[1];
  if (secondary.seconds + .05 >= 4 && secondary.seconds >= total * .25) awards[secondary.id] = 1;
  return awards;
}

export function dominantBattleFormation(seconds: Partial<Record<BattleFormationId, number>>): BattleFormationId {
  return [...BATTLE_FORMATION_IDS].sort((a, b) => (seconds[b] ?? 0) - (seconds[a] ?? 0) || BATTLE_FORMATION_IDS.indexOf(a) - BATTLE_FORMATION_IDS.indexOf(b))[0];
}
