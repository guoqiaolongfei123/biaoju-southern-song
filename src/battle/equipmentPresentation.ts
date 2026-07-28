import { EQUIPMENT, equipmentDisplayName, equipmentTuningLevel, type EquipmentDefinition } from "../core/equipmentContent";
import type { EquipmentId } from "../core/types";
import type { BattleStrategy, GuardSupportKind } from "./simulation";

export type BattleGearTrait = NonNullable<EquipmentDefinition["battleTrait"]>;

export interface BattleGearBadge {
  equipmentId: EquipmentId;
  name: string;
  seal: string;
  trait: BattleGearTrait;
  color: number;
  tuningLevel: number;
}

const TRAIT_COLOR: Record<BattleGearTrait, number> = {
  crossbow: 0xd8b568,
  shield: 0x80aa8d,
  medicine: 0x84b697,
  "horse-hook": 0xd39b57,
  "wheel-hook": 0xc5a05f,
};

const TRAIT_PRIORITY: Record<BattleGearTrait, number> = {
  crossbow: 500,
  shield: 400,
  medicine: 300,
  "horse-hook": 200,
  "wheel-hook": 100,
};

export function battleGearBadges(equipmentIds: EquipmentId[], limit = 2, tuning: Partial<Record<EquipmentId, number>> = {}): BattleGearBadge[] {
  const seen = new Set<BattleGearTrait>();
  return equipmentIds
    .map((equipmentId) => EQUIPMENT[equipmentId])
    .filter((equipment): equipment is EquipmentDefinition & { battleTrait: BattleGearTrait } => Boolean(equipment?.battleTrait))
    .sort((a, b) => TRAIT_PRIORITY[b.battleTrait] - TRAIT_PRIORITY[a.battleTrait] || a.id.localeCompare(b.id))
    .filter((equipment) => {
      if (seen.has(equipment.battleTrait)) return false;
      seen.add(equipment.battleTrait);
      return true;
    })
    .slice(0, Math.max(0, limit))
    .map((equipment) => ({
      equipmentId: equipment.id,
      name: equipmentDisplayName(equipment, tuning[equipment.id]),
      seal: equipment.seal,
      trait: equipment.battleTrait,
      color: TRAIT_COLOR[equipment.battleTrait],
      tuningLevel: equipmentTuningLevel(tuning[equipment.id]),
    }));
}

export function battleGearSupportsAction(badge: BattleGearBadge, support: GuardSupportKind | null): boolean {
  if (!support) return false;
  if (badge.trait === "crossbow") return support === "crossbow" || support === "volley";
  if (support === "core-counter") return badge.trait === "shield";
  return badge.trait === support;
}

export function battleGearRespondsToStrategy(badge: BattleGearBadge, strategy: BattleStrategy): boolean {
  if (strategy === "focus-fire") return badge.trait === "crossbow";
  if (strategy === "guard-cart") return badge.trait === "shield" || badge.trait === "wheel-hook";
  if (strategy === "repair-cart") return badge.trait === "wheel-hook";
  if (strategy === "guard-horses") return badge.trait === "horse-hook";
  if (strategy === "rescue") return badge.trait === "medicine";
  return false;
}
