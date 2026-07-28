import type { CrewEquipment, EquipmentId, EquipmentSlot } from "./types";

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  seal: string;
  slot: EquipmentSlot;
  price: number;
  requiredRank: number;
  description: string;
  source?: "shop" | "journey";
  rarity?: "ordinary" | "fine" | "treasure";
  origin?: string;
  battleTrait?: "crossbow" | "medicine" | "horse-hook" | "wheel-hook" | "shield";
  powerBonus?: number;
  maxHpBonus?: number;
  armorMultiplier?: number;
  cartGuardBonus?: number;
  horseGuardBonus?: number;
}

export const EQUIPMENT: Record<EquipmentId, EquipmentDefinition> = {
  "jujube-spear": { id: "jujube-spear", name: "枣木长枪", seal: "枪", slot: "weapon", price: 28, requiredRank: 0, powerBonus: .1, description: "枪杆坚韧，列阵时攻势提升一成。" },
  "yanling-sabre": { id: "yanling-sabre", name: "雁翎腰刀", seal: "刀", slot: "weapon", price: 52, requiredRank: 1, powerBonus: .18, description: "刃轻而利，熟手方能尽展锋芒。" },
  "arm-crossbow": { id: "arm-crossbow", name: "踏张弩", seal: "弩", slot: "weapon", price: 74, requiredRank: 2, powerBonus: .26, battleTrait: "crossbow", description: "近阵重弩，须老手才能稳准施放。" },
  "leather-jacket": { id: "leather-jacket", name: "皮札护身", seal: "札", slot: "armor", price: 32, requiredRank: 0, maxHpBonus: 8, armorMultiplier: .93, description: "轻便皮札，添八点体魄并减轻来伤。" },
  "iron-vest": { id: "iron-vest", name: "铁叶背心", seal: "铁", slot: "armor", price: 68, requiredRank: 1, maxHpBonus: 18, armorMultiplier: .84, description: "细铁叶缀成，显著增强临阵耐久。" },
  "rattan-shield": { id: "rattan-shield", name: "浸油藤牌", seal: "牌", slot: "armor", price: 48, requiredRank: 1, maxHpBonus: 10, armorMultiplier: .89, cartGuardBonus: .08, battleTrait: "shield", description: "可挡箭火，围车时攻守更稳。" },
  "medicine-kit": { id: "medicine-kit", name: "金疮药囊", seal: "药", slot: "tool", price: 36, requiredRank: 0, maxHpBonus: 10, battleTrait: "medicine", description: "止血药与绷带齐备，增加临阵体魄。" },
  "horse-tackle": { id: "horse-tackle", name: "护马短钩", seal: "马", slot: "tool", price: 46, requiredRank: 0, horseGuardBonus: .18, battleTrait: "horse-hook", description: "专挡割缰手，护马阵中出手更狠。" },
  "wheel-hook": { id: "wheel-hook", name: "固轮挠钩", seal: "轮", slot: "tool", price: 44, requiredRank: 0, cartGuardBonus: .16, battleTrait: "wheel-hook", description: "倚车拒敌，停阵护车时更有章法。" },
  "frontier-hook-spear": { id: "frontier-hook-spear", name: "朔边钩镰枪", seal: "钩", slot: "weapon", price: 0, requiredRank: 1, powerBonus: .2, horseGuardBonus: .14, battleTrait: "horse-hook", source: "journey", rarity: "treasure", origin: "边寨缴获", description: "金军旧式钩镰长枪，能隔阵钩住割缰手；只从凶险护镖的胜阵中缴获。" },
  "watch-crossbow": { id: "watch-crossbow", name: "神臂样弩", seal: "臂", slot: "weapon", price: 0, requiredRank: 2, powerBonus: .29, battleTrait: "crossbow", source: "journey", rarity: "treasure", origin: "军铺封藏", description: "依神臂弓旧样改制的近阵强弩，可参与自动点杀与集中齐射。" },
  "field-medicine-chest": { id: "field-medicine-chest", name: "行军针药匣", seal: "济", slot: "tool", price: 0, requiredRank: 1, maxHpBonus: 14, battleTrait: "medicine", source: "journey", rarity: "treasure", origin: "活镖谢礼", description: "分格收纳刀创药、针线与止血散，危急时会自动为阵中伤者施治。" },
  "black-lacquer-shield": { id: "black-lacquer-shield", name: "黑漆团牌", seal: "盾", slot: "armor", price: 0, requiredRank: 1, maxHpBonus: 16, armorMultiplier: .85, cartGuardBonus: .1, battleTrait: "shield", source: "journey", rarity: "treasure", origin: "匪寨战利", description: "木胎蒙革、黑漆压纹的坚牌，围车时会自动举牌截住贴车敌手。" },
};

export const EQUIPMENT_LIST = Object.values(EQUIPMENT);
export const JOURNEY_EQUIPMENT_REWARDS = EQUIPMENT_LIST.filter((item) => item.source === "journey");
export const SLOT_LABEL: Record<EquipmentSlot, string> = { weapon: "兵刃", armor: "护具", tool: "行具" };
export const MAX_EQUIPMENT_TUNING = 3;

const EQUIPMENT_TUNING_GRADE = ["原制", "修整", "精校", "名匠"] as const;

export function equipmentTuningLevel(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_EQUIPMENT_TUNING, Math.floor(value)))
    : 0;
}

export function equipmentTuningGrade(level: number): string {
  return EQUIPMENT_TUNING_GRADE[equipmentTuningLevel(level)];
}

export function equipmentTuningMultiplier(level: number): number {
  return 1 + equipmentTuningLevel(level) * .12;
}

export function equipmentDisplayName(item: EquipmentDefinition, level = 0): string {
  const tuned = equipmentTuningLevel(level);
  return tuned > 0 ? `${item.name}〔${equipmentTuningGrade(tuned)}〕` : item.name;
}

export function createInitialEquipmentStock(): Record<EquipmentId, number> {
  return Object.fromEntries(EQUIPMENT_LIST.map((item) => [item.id, ["jujube-spear", "leather-jacket"].includes(item.id) ? 2 : ["medicine-kit", "horse-tackle", "wheel-hook"].includes(item.id) ? 1 : 0])) as Record<EquipmentId, number>;
}

export function createInitialEquipmentTuning(): Record<EquipmentId, number> {
  return Object.fromEntries(EQUIPMENT_LIST.map((item) => [item.id, 0])) as Record<EquipmentId, number>;
}

export function createInitialCrewEquipment(): Record<string, CrewEquipment> {
  return {
    "player-leader": { weapon: "jujube-spear", armor: "leather-jacket" },
    "lu-cang": { weapon: "jujube-spear", armor: "leather-jacket" },
    "qiao-qing": { tool: "horse-tackle" },
    "he-sheng": { tool: "wheel-hook" },
    "su-wen": { tool: "medicine-kit" },
  };
}

export function normalizeEquipmentStock(value: unknown): Record<EquipmentId, number> {
  const source = value && typeof value === "object" ? value as Partial<Record<EquipmentId, unknown>> : {};
  const fallback = createInitialEquipmentStock();
  return Object.fromEntries(EQUIPMENT_LIST.map((item) => {
    const count = source[item.id];
    return [item.id, typeof count === "number" && count >= 0 ? Math.floor(count) : fallback[item.id]];
  })) as Record<EquipmentId, number>;
}

export function normalizeEquipmentTuning(value: unknown): Record<EquipmentId, number> {
  const source = value && typeof value === "object" ? value as Partial<Record<EquipmentId, unknown>> : {};
  return Object.fromEntries(EQUIPMENT_LIST.map((item) => [item.id, equipmentTuningLevel(source[item.id])])) as Record<EquipmentId, number>;
}

export function normalizeCrewEquipment(value: unknown): Record<string, CrewEquipment> {
  if (!value || typeof value !== "object") return createInitialCrewEquipment();
  const result: Record<string, CrewEquipment> = {};
  for (const [crewId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const source = raw as Partial<Record<EquipmentSlot, unknown>>;
    const loadout: CrewEquipment = {};
    for (const slot of ["weapon", "armor", "tool"] as const) {
      const id = source[slot];
      if (typeof id === "string" && id in EQUIPMENT && EQUIPMENT[id as EquipmentId].slot === slot) loadout[slot] = id as EquipmentId;
    }
    result[crewId] = loadout;
  }
  if (!("player-leader" in result)) result["player-leader"] = { ...createInitialCrewEquipment()["player-leader"] };
  return result;
}

export function equipmentStats(loadout: CrewEquipment | undefined, tuning: Partial<Record<EquipmentId, number>> = {}) {
  const items = loadout ? Object.values(loadout).filter((id): id is EquipmentId => Boolean(id)).map((id) => ({ item: EQUIPMENT[id], level: equipmentTuningLevel(tuning[id]) })) : [];
  return {
    names: items.map(({ item, level }) => equipmentDisplayName(item, level)),
    powerBonus: items.reduce((sum, { item, level }) => sum + (item.powerBonus ?? 0) * equipmentTuningMultiplier(level), 0),
    maxHpBonus: items.reduce((sum, { item, level }) => sum + Math.round((item.maxHpBonus ?? 0) * equipmentTuningMultiplier(level)), 0),
    armorMultiplier: items.reduce((value, { item, level }) => {
      const reduction = (1 - (item.armorMultiplier ?? 1)) * equipmentTuningMultiplier(level);
      return value * Math.max(.5, 1 - reduction);
    }, 1),
    cartGuardBonus: items.reduce((sum, { item, level }) => sum + (item.cartGuardBonus ?? 0) * equipmentTuningMultiplier(level), 0),
    horseGuardBonus: items.reduce((sum, { item, level }) => sum + (item.horseGuardBonus ?? 0) * equipmentTuningMultiplier(level), 0),
  };
}

export function equipmentHasBattleTrait(equipmentId: EquipmentId, trait: NonNullable<EquipmentDefinition["battleTrait"]>): boolean {
  return EQUIPMENT[equipmentId]?.battleTrait === trait;
}

const BATTLE_TRAIT_LABEL: Record<NonNullable<EquipmentDefinition["battleTrait"]>, string> = {
  crossbow: "自动点杀·齐射",
  medicine: "自动救治",
  "horse-hook": "自动截缰",
  "wheel-hook": "自动固轮",
  shield: "自动举牌",
};

export function equipmentEffectSummary(item: EquipmentDefinition, level = 0): string {
  const multiplier = equipmentTuningMultiplier(level);
  const effects = [
    item.powerBonus ? `攻势 +${Math.round(item.powerBonus * multiplier * 100)}%` : "",
    item.maxHpBonus ? `体魄 +${Math.round(item.maxHpBonus * multiplier)}` : "",
    item.armorMultiplier && item.armorMultiplier < 1 ? `减伤 +${Math.round((1 - item.armorMultiplier) * multiplier * 100)}%` : "",
    item.cartGuardBonus ? `护车 +${Math.round(item.cartGuardBonus * multiplier * 100)}%` : "",
    item.horseGuardBonus ? `护马 +${Math.round(item.horseGuardBonus * multiplier * 100)}%` : "",
    item.battleTrait ? BATTLE_TRAIT_LABEL[item.battleTrait] : "",
  ].filter(Boolean);
  return effects.join(" · ");
}

export function equippedCount(loadouts: Record<string, CrewEquipment>, equipmentId: EquipmentId, exceptCrewId?: string): number {
  return Object.entries(loadouts).reduce((count, [crewId, loadout]) => count + (crewId !== exceptCrewId && Object.values(loadout).includes(equipmentId) ? 1 : 0), 0);
}
