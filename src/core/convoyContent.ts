import type { ConvoyState, ConvoyUpgradeId, HorseTeamId, RouteTerrain, WagonId } from "./types";

export interface WagonDefinition {
  id: WagonId;
  name: string;
  seal: string;
  price: number;
  description: string;
  armor: number;
  cargoProtection: number;
  fatigueMultiplier: number;
  upgradeSlots: number;
  dayModifier: Partial<Record<RouteTerrain, number>>;
}

export interface HorseTeamDefinition {
  id: HorseTeamId;
  name: string;
  seal: string;
  price: number;
  description: string;
  protection: number;
  fatigueMultiplier: number;
  terrainFatigue: Partial<Record<RouteTerrain, number>>;
  dayModifier: Partial<Record<RouteTerrain, number>>;
}

export interface ConvoyUpgradeDefinition {
  id: ConvoyUpgradeId;
  name: string;
  seal: string;
  price: number;
  description: string;
  reputationRequired: number;
}

export const WAGONS: Record<WagonId, WagonDefinition> = {
  "covered-cart": {
    id: "covered-cart", name: "榆木篷车", seal: "篷", price: 0,
    description: "总号旧车，轻重适中，可装两件改装。", armor: 0.92, cargoProtection: 0.94, fatigueMultiplier: 1, upgradeSlots: 2, dayModifier: {},
  },
  "swift-cart": {
    id: "swift-cart", name: "轻辕快车", seal: "疾", price: 72,
    description: "车身轻、转向快，走官道省时，但经不起围攻。", armor: 1.12, cargoProtection: 1.06, fatigueMultiplier: 0.86, upgradeSlots: 1, dayModifier: { official: -1 },
  },
  "armored-cart": {
    id: "armored-cart", name: "铁叶重车", seal: "甲", price: 108,
    description: "车壁覆铁叶，最耐钩索与乱箭；笨重，沿途多费脚程。", armor: 0.65, cargoProtection: 0.72, fatigueMultiplier: 1.22, upgradeSlots: 3, dayModifier: { official: 1, mountain: 1 },
  },
};

export const HORSE_TEAMS: Record<HorseTeamId, HorseTeamDefinition> = {
  "draft-pair": {
    id: "draft-pair", name: "青骢挽马", seal: "驮", price: 0,
    description: "性情稳、耐长途，快慢都不偏。", protection: 1, fatigueMultiplier: 1, terrainFatigue: {}, dayModifier: {},
  },
  "post-pair": {
    id: "post-pair", name: "驿道健马", seal: "驰", price: 68,
    description: "平路脚程快，连续翻山却容易掉膘。", protection: 0.9, fatigueMultiplier: 1.08, terrainFatigue: { official: 0.82, mountain: 1.24 }, dayModifier: { official: -1 },
  },
  "mountain-mules": {
    id: "mountain-mules", name: "川峡骡队", seal: "岭", price: 56,
    description: "山道站得稳，也更省草料；官道上没有快马迅捷。", protection: 0.84, fatigueMultiplier: 0.92, terrainFatigue: { mountain: 0.68 }, dayModifier: { mountain: -1 },
  },
};

export const CONVOY_UPGRADES: Record<ConvoyUpgradeId, ConvoyUpgradeDefinition> = {
  "iron-wheels": { id: "iron-wheels", name: "铁包车轮", seal: "輪", price: 38, description: "泥泞、碎石与绕关时少伤车轮。", reputationRequired: 18 },
  "spare-axle": { id: "spare-axle", name: "备用车轴", seal: "軸", price: 31, description: "坏轴时可原地替换，不再耗粮误事。", reputationRequired: 12 },
  "hidden-compartment": { id: "hidden-compartment", name: "暗格夹层", seal: "匣", price: 46, description: "敏感镖物换票藏匣时少耗一份补给。", reputationRequired: 30 },
  "fireproof-awning": { id: "fireproof-awning", name: "浸矾篷布", seal: "篷", price: 42, description: "暴雨、火矢与劫车时更能保住镖物。", reputationRequired: 24 },
};

export const DEFAULT_CONVOY_EQUIPMENT: Pick<ConvoyState, "wagonId" | "horseTeamId" | "horseHp" | "horseStamina" | "upgrades"> = {
  wagonId: "covered-cart",
  horseTeamId: "draft-pair",
  horseHp: 100,
  horseStamina: 100,
  upgrades: [],
};

export function hasConvoyUpgrade(convoy: ConvoyState, upgrade: ConvoyUpgradeId): boolean {
  return convoy.upgrades.includes(upgrade);
}

export function wagonDamageMultiplier(convoy: ConvoyState): number {
  return WAGONS[convoy.wagonId].armor * (hasConvoyUpgrade(convoy, "iron-wheels") ? 0.72 : 1);
}

export function cargoDamageMultiplier(convoy: ConvoyState): number {
  return WAGONS[convoy.wagonId].cargoProtection * (hasConvoyUpgrade(convoy, "fireproof-awning") ? 0.58 : 1);
}
