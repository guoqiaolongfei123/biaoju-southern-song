import type { MartialArtId } from "./types";

export interface MartialArtDefinition {
  id: MartialArtId;
  name: string;
  seal: string;
  school: string;
  description: string;
  technique: string;
  techniqueHint: string;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  knockback: number;
  techniqueCooldown: number;
}

export const MARTIAL_ARTS: Record<MartialArtId, MartialArtDefinition> = {
  "guard-spear": {
    id: "guard-spear",
    name: "岳门拒马枪",
    seal: "槍",
    school: "军阵长兵",
    description: "枪长一寸，车前便多一寸余地；适合隔开成群来敌，替车马争取脚程。",
    technique: "横枪拒马",
    techniqueHint: "震退身前群敌，钩索与火手也难贴车",
    attackRange: 108,
    attackDamage: 30,
    attackCooldown: 0.48,
    knockback: 30,
    techniqueCooldown: 8,
  },
  "severing-sabre": {
    id: "severing-sabre",
    name: "断索快刀",
    seal: "刀",
    school: "江湖短兵",
    description: "脚下追人、刀口追索，专门扑杀钩索手、斩缰手和近车火手。",
    technique: "赶步断索",
    techniqueHint: "突进重创最近的劫车能手",
    attackRange: 82,
    attackDamage: 39,
    attackCooldown: 0.36,
    knockback: 20,
    techniqueCooldown: 6,
  },
  "binding-hands": {
    id: "binding-hands",
    name: "缠拿短手",
    seal: "擒",
    school: "行院擒拿",
    description: "不求刀下见血，以卸腕锁身制住近敌；短促凶险，却能让敌阵突然停手。",
    technique: "锁腕卸械",
    techniqueHint: "制住近身数敌，使其四息不能行动",
    attackRange: 68,
    attackDamage: 25,
    attackCooldown: 0.3,
    knockback: 12,
    techniqueCooldown: 7,
  },
};

export const MARTIAL_ART_LIST = Object.values(MARTIAL_ARTS);
export const DEFAULT_MARTIAL_ART: MartialArtId = "guard-spear";

export function martialArtById(id?: MartialArtId): MartialArtDefinition {
  return MARTIAL_ARTS[id ?? DEFAULT_MARTIAL_ART] ?? MARTIAL_ARTS[DEFAULT_MARTIAL_ART];
}
