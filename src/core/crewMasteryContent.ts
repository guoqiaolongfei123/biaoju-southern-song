import type { CrewMasteryId, CrewRole } from "./types";

export type CrewMasterySpecial = "formation-command" | "carrier-hunter" | "convoy-keeper" | "threat-reader" | "field-revival" | "pathfinder" | "steady-heart";

export interface CrewMasteryDefinition {
  id: CrewMasteryId;
  role: CrewRole;
  name: string;
  seal: string;
  motto: string;
  description: string;
  effect: string;
  special: CrewMasterySpecial;
  modifiers: {
    power: number;
    maxHp: number;
    armor: number;
    speed: number;
    supportCooldown: number;
    engageRange: number;
    cartGuard: number;
    horseGuard: number;
    convoyProtection: number;
  };
}

const STANDARD_MODIFIERS: CrewMasteryDefinition["modifiers"] = {
  power: 1,
  maxHp: 0,
  armor: 1,
  speed: 1,
  supportCooldown: 1,
  engageRange: 0,
  cartGuard: 0,
  horseGuard: 0,
  convoyProtection: 1,
};

export const CREW_MASTERIES: Record<CrewMasteryId, CrewMasteryDefinition> = {
  "deputy-command": {
    id: "deputy-command", role: "副镖头", name: "镇场传令", seal: "令", motto: "旗转而阵不乱",
    description: "换阵时替镖头接过号令，让全队的振奋维持更久；自动作战仍按玩家所下阵令推进。",
    effect: "换阵振奋延长 2 息 · 攻势 +5% · 承伤 -4%", special: "formation-command",
    modifiers: { ...STANDARD_MODIFIERS, power: 1.05, armor: .96 },
  },
  "runner-pursuit": {
    id: "runner-pursuit", role: "趟子手", name: "穿阵飞脚", seal: "疾", motto: "镖去一丈，人先两丈",
    description: "追逐战中自行越过车阵截住夺镖者，不必由玩家单独点选目标。",
    effect: "追镖移速 +25% · 追镖接敌范围 +90 · 常态移速 +12%", special: "carrier-hunter",
    modifiers: { ...STANDARD_MODIFIERS, speed: 1.12, engageRange: 24 },
  },
  "driver-warden": {
    id: "driver-warden", role: "车把式", name: "人车一脉", seal: "辙", motto: "听轴知险，贴辙挡刀",
    description: "始终把自己放在车马最危险的一侧，近身时会替车轮与挽具分担冲击。",
    effect: "近身车马承伤 -10% · 固车 +8% · 护马 +5%", special: "convoy-keeper",
    modifiers: { ...STANDARD_MODIFIERS, cartGuard: .08, horseGuard: .05, convoyProtection: .9 },
  },
  "clerk-reader": {
    id: "clerk-reader", role: "账房", name: "辨凶识诈", seal: "察", motto: "先看手，再看眼",
    description: "从兵器、衣着与号令中认出匪首和劫车能手，自动提醒同伴优先截击。",
    effect: "优先攻击匪首与专手 · 攻势 +6% · 接敌范围 +18", special: "threat-reader",
    modifiers: { ...STANDARD_MODIFIERS, power: 1.06, engageRange: 18 },
  },
  "medic-revival": {
    id: "medic-revival", role: "医师", name: "阵前回生", seal: "生", motto: "气未绝，便能救",
    description: "每场战斗可自动救回一名倒地同伴；若另配药囊，后续救治也会更频繁。",
    effect: "每战救回 1 人 · 器械回转 -25%", special: "field-revival",
    modifiers: { ...STANDARD_MODIFIERS, supportCooldown: .75 },
  },
  "guide-foresight": {
    id: "guide-foresight", role: "向导", name: "先声避伏", seal: "先", motto: "草动之前，先见刀光",
    description: "开战时先认出伏兵来路，使第一轮来敌短暂失去先手，自己也更快补位。",
    effect: "开战迟滞群敌 · 移速 +10% · 接敌范围 +26", special: "pathfinder",
    modifiers: { ...STANDARD_MODIFIERS, speed: 1.1, engageRange: 26 },
  },
  "cook-heart": {
    id: "cook-heart", role: "厨子", name: "安众定心", seal: "安", motto: "先稳人心，再稳车阵",
    description: "战局第一次危急时自动稳住队伍，让仍在阵中的同伴缓回一口气。",
    effect: "危急时全队恢复 6 点 · 体魄 +8 · 承伤 -5%", special: "steady-heart",
    modifiers: { ...STANDARD_MODIFIERS, maxHp: 8, armor: .95 },
  },
};

export const CREW_MASTERY_LIST = Object.values(CREW_MASTERIES);

const MASTERY_BY_ROLE = Object.fromEntries(CREW_MASTERY_LIST.map((mastery) => [mastery.role, mastery])) as Record<CrewRole, CrewMasteryDefinition>;

export function crewMasteryForRole(role: CrewRole, rankLevel: number): CrewMasteryDefinition | null {
  return rankLevel >= 2 ? MASTERY_BY_ROLE[role] : null;
}

export function crewMasteryById(id?: CrewMasteryId | null): CrewMasteryDefinition | null {
  return id ? CREW_MASTERIES[id] ?? null : null;
}
