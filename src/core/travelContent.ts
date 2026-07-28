import type { TravelStance } from "./types";

export interface TravelStanceDefinition {
  id: TravelStance;
  seal: string;
  title: string;
  subtitle: string;
  description: string;
  dayModifier: number;
  supplyModifier: number;
  staminaMultiplier: number;
  dangerModifier: number;
  inspectionCover: number;
  advanceVerb: string;
  travelNote: string;
}

export const TRAVEL_STANCES: Record<TravelStance, TravelStanceDefinition> = {
  steady: {
    id: "steady",
    seal: "穩",
    title: "按旗稳行",
    subtitle: "照常程起落宿",
    description: "按驿程行止，车马、时日与声势彼此均衡。",
    dayModifier: 0,
    supplyModifier: 0,
    staminaMultiplier: 1,
    dangerModifier: 0,
    inspectionCover: 0,
    advanceVerb: "整队前行",
    travelNote: "按常程前进，仍可能遇到天气、盘查与剪径客。",
  },
  haste: {
    id: "haste",
    seal: "疾",
    title: "昼夜兼程",
    subtitle: "抢期限催马赶路",
    description: "每段力争省下一日，但多耗草料，马乏时反会失速，沿途也更惹眼。",
    dayModifier: -1,
    supplyModifier: 1,
    staminaMultiplier: 1.32,
    dangerModifier: 9,
    inspectionCover: -0.07,
    advanceVerb: "催马赶程",
    travelNote: "疾驱会加重马力消耗与临战压力；马力不足时省不下行程。",
  },
  covert: {
    id: "covert",
    seal: "潛",
    title: "偃旗潜行",
    subtitle: "避耳目绕村过宿",
    description: "每段多费一日与口粮，换取更低的暴露、盘查与遭伏压力。",
    dayModifier: 1,
    supplyModifier: 1,
    staminaMultiplier: 0.86,
    dangerModifier: -8,
    inspectionCover: 0.14,
    advanceVerb: "偃旗上路",
    travelNote: "潜行更慢、更耗粮，却能减轻边关抽验和战斗压力。",
  },
};

export const TRAVEL_STANCE_LIST = Object.values(TRAVEL_STANCES);

export function travelStanceById(id: TravelStance | undefined): TravelStanceDefinition {
  return TRAVEL_STANCES[id ?? "steady"];
}
