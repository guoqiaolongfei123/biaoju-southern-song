import type { CrewDisciplineId } from "./types";

export interface CrewDisciplineDefinition {
  id: CrewDisciplineId;
  name: string;
  seal: string;
  motto: string;
  description: string;
  effect: string;
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

export const CREW_DISCIPLINES: Record<CrewDisciplineId, CrewDisciplineDefinition> = {
  vanguard: {
    id: "vanguard",
    name: "踏阵先锋",
    seal: "锋",
    motto: "见隙越阵，先截凶顽",
    description: "站位前压，主动扩大接敌范围；适合配兵刃、踏张弩，追斩匪首与夺镖者。",
    effect: "攻势 +12% · 移速 +6% · 接敌范围 +55",
    modifiers: { power: 1.12, maxHp: 0, armor: 1.04, speed: 1.06, supportCooldown: 1, engageRange: 55, cartGuard: 0, horseGuard: 0, convoyProtection: 1 },
  },
  bulwark: {
    id: "bulwark",
    name: "镇车执旗",
    seal: "镇",
    motto: "人不离车，旗不离阵",
    description: "贴近车马承受冲击；在身边时会替车马挡下一部分伤害，适合藤牌与固轮挠钩。",
    effect: "体魄 +10 · 承伤 -10% · 近身护车马 -12%",
    modifiers: { power: 1, maxHp: 10, armor: .9, speed: .94, supportCooldown: 1, engageRange: -18, cartGuard: .1, horseGuard: .08, convoyProtection: .88 },
  },
  responder: {
    id: "responder",
    name: "游阵策应",
    seal: "应",
    motto: "听令补位，器械先行",
    description: "在阵间快速补位，并更频繁地使用药囊、弩具与护阵器械，适合承担自动支援。",
    effect: "移速 +12% · 器械回转 -28% · 护车护马 +4%",
    modifiers: { power: .97, maxHp: 0, armor: 1, speed: 1.12, supportCooldown: .72, engageRange: 20, cartGuard: .04, horseGuard: .04, convoyProtection: 1 },
  },
};

export const CREW_DISCIPLINE_LIST = Object.values(CREW_DISCIPLINES);

export function crewDisciplineById(id?: CrewDisciplineId | null): CrewDisciplineDefinition | null {
  return id ? CREW_DISCIPLINES[id] ?? null : null;
}
