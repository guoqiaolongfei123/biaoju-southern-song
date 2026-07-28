import type { CrewInjury, CrewInjuryId } from "./types";

export interface CrewInjuryDefinition {
  id: CrewInjuryId;
  name: string;
  seal: string;
  severity: 1 | 2 | 3;
  description: string;
  effect: string;
  recoveryDays: number;
  modifiers: {
    power: number;
    armor: number;
    speed: number;
    supportCooldown: number;
    travelDelay: number;
  };
}

export const CREW_INJURIES: Record<CrewInjuryId, CrewInjuryDefinition> = {
  "blade-wound": {
    id: "blade-wound",
    name: "刀创未合",
    seal: "刃",
    severity: 1,
    description: "创口已经止血，但挥兵发力仍会牵动伤处。",
    effect: "攻势 -7% · 器械回转 +6%",
    recoveryDays: 3,
    modifiers: { power: .93, armor: 1, speed: .98, supportCooldown: 1.06, travelDelay: 0 },
  },
  sprain: {
    id: "sprain",
    name: "筋骨扭伤",
    seal: "筋",
    severity: 2,
    description: "腿脚筋骨受挫，追敌和阵间补位都会慢上一拍。",
    effect: "移速 -18% · 攻势 -5%",
    recoveryDays: 4,
    modifiers: { power: .95, armor: 1, speed: .82, supportCooldown: 1.08, travelDelay: 0 },
  },
  fracture: {
    id: "fracture",
    name: "骨伤难行",
    seal: "骨",
    severity: 3,
    description: "骨伤未愈，仍可勉强随队，却会拖慢整支镖队。",
    effect: "攻势 -22% · 移速 -32% · 每程 +1日",
    recoveryDays: 7,
    modifiers: { power: .78, armor: 1.12, speed: .68, supportCooldown: 1.28, travelDelay: 1 },
  },
  "internal-trauma": {
    id: "internal-trauma",
    name: "内伤郁结",
    seal: "脉",
    severity: 3,
    description: "气息未平，久战后容易力竭，也更难承受下一次重击。",
    effect: "攻势 -14% · 承伤 +18% · 每程 +1日",
    recoveryDays: 6,
    modifiers: { power: .86, armor: 1.18, speed: .9, supportCooldown: 1.16, travelDelay: 1 },
  },
};

export const CREW_INJURY_LIST = Object.values(CREW_INJURIES);

export function crewInjuryById(id?: CrewInjuryId | null): CrewInjuryDefinition | null {
  return id ? CREW_INJURIES[id] ?? null : null;
}

function injuryHash(seed: number, crewId: string): number {
  let value = seed | 0;
  for (const character of crewId) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return Math.abs(value | 0);
}

export function injuryForBattleDamage(damage: number, seed: number, crewId: string): CrewInjuryId | null {
  if (damage < 18) return null;
  const variant = injuryHash(seed, crewId) % 2;
  if (damage >= 40) return variant ? "fracture" : "internal-trauma";
  if (damage >= 27) return variant ? "sprain" : "internal-trauma";
  return "blade-wound";
}

export function createCrewInjury(id: CrewInjuryId, acquiredDay: number): CrewInjury {
  return { id, remainingDays: CREW_INJURIES[id].recoveryDays, acquiredDay };
}

export function mergeCrewInjury(current: CrewInjury | null, incomingId: CrewInjuryId, acquiredDay: number): CrewInjury {
  const incoming = createCrewInjury(incomingId, acquiredDay);
  if (!current) return incoming;
  const currentDefinition = CREW_INJURIES[current.id];
  const incomingDefinition = CREW_INJURIES[incomingId];
  if (incomingDefinition.severity > currentDefinition.severity) return incoming;
  if (incomingDefinition.severity < currentDefinition.severity) return { ...current, remainingDays: Math.min(currentDefinition.recoveryDays + 2, current.remainingDays + 1) };
  return incomingDefinition.recoveryDays >= currentDefinition.recoveryDays
    ? { ...incoming, remainingDays: Math.max(incoming.remainingDays, current.remainingDays) }
    : { ...current, remainingDays: Math.max(current.remainingDays, incoming.remainingDays) };
}

export function recoverCrewInjury(injury: CrewInjury | null, days: number): CrewInjury | null {
  if (!injury || days <= 0) return injury;
  const remainingDays = injury.remainingDays - days;
  return remainingDays > 0 ? { ...injury, remainingDays } : null;
}

export function normalizeCrewInjury(value: unknown): CrewInjury | null {
  if (!value || typeof value !== "object") return null;
  const injury = value as Partial<CrewInjury>;
  if (typeof injury.id !== "string" || !(injury.id in CREW_INJURIES)) return null;
  return {
    id: injury.id as CrewInjuryId,
    remainingDays: Math.max(1, Math.round(typeof injury.remainingDays === "number" ? injury.remainingDays : CREW_INJURIES[injury.id as CrewInjuryId].recoveryDays)),
    acquiredDay: Math.max(1, Math.round(typeof injury.acquiredDay === "number" ? injury.acquiredDay : 1)),
  };
}
