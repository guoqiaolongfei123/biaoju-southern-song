import { FACTIONS } from "./data";
import { isBorderSensitive } from "./content";
import type { FactionId, GameState, RoutePlan, TravelCoverId } from "./types";

export interface TravelCoverDefinition {
  id: TravelCoverId;
  seal: string;
  title: string;
  subtitle: string;
  description: string;
  cost: number;
}

export type TravelCoverFit = "open" | "strong" | "usable" | "shaky" | "poor";

export interface TravelCoverAssessment {
  definition: TravelCoverDefinition;
  targetFaction: FactionId | null;
  fit: TravelCoverFit;
  fitLabel: string;
  score: number;
  inspectionCover: number;
  strengths: string[];
  warnings: string[];
}

export const TRAVEL_COVERS: Record<TravelCoverId, TravelCoverDefinition> = {
  "open-escort": {
    id: "open-escort",
    seal: "镖",
    title: "亮旗正行",
    subtitle: "凭字号、路引与银钱过关",
    description: "不藏风云行旗号，遇关照章查验。最稳妥，也最考验路引与当地声望。",
    cost: 0,
  },
  "merchant-caravan": {
    id: "merchant-caravan",
    seal: "商",
    title: "商旅行票",
    subtitle: "改旗作行商，货票彼此照应",
    description: "备下牙行票、货样和沿途账目；货镖与副货越像真买卖，巡骑越难看出破绽。",
    cost: 8,
  },
  "pilgrim-party": {
    id: "pilgrim-party",
    seal: "香",
    title: "香客行脚",
    subtitle: "收旗入囊，随香会缓行",
    description: "用香册、药箱和善会名帖掩住身份，适合书信与护人，却遮不住重货和军器。",
    cost: 6,
  },
  "military-train": {
    id: "military-train",
    seal: "驿",
    title: "行院军差",
    subtitle: "冒作递铺，按军牒催行",
    description: "仿制军前关牒与驿牌，押送军务最为顺手；若无人懂军中规矩，反会惹来细查。",
    cost: 11,
  },
};

export const TRAVEL_COVER_LIST = Object.values(TRAVEL_COVERS);

export function travelCoverById(id?: TravelCoverId | null): TravelCoverDefinition {
  return TRAVEL_COVERS[id ?? "open-escort"] ?? TRAVEL_COVERS["open-escort"];
}

export function routeBorderFactions(game: GameState, plan: RoutePlan | undefined = game.journey?.plan): FactionId[] {
  if (!plan) return [];
  return plan.cityIds.slice(1).reduce<FactionId[]>((result, cityId, index) => {
    const previousOwner = game.cities[plan.cityIds[index]]?.owner;
    const owner = game.cities[cityId]?.owner;
    if (owner && previousOwner && owner !== previousOwner && !result.includes(owner)) result.push(owner);
    return result;
  }, []);
}

function selectedCrew(game: GameState) {
  const ids = game.journey?.crewIds?.length ? game.journey.crewIds : game.activeCrewIds;
  return ids.map((id) => game.crew.find((member) => member.id === id)).filter((member): member is GameState["crew"][number] => Boolean(member));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function travelCoverAssessment(game: GameState, coverId: TravelCoverId = game.journey?.coverId ?? "open-escort", targetFaction: FactionId | null = null): TravelCoverAssessment {
  const definition = travelCoverById(coverId);
  const contract = game.journey?.contract;
  if (!contract || coverId === "open-escort") {
    return {
      definition,
      targetFaction,
      fit: "open",
      fitLabel: "不作伪装",
      score: 0,
      inspectionCover: 0,
      strengths: [],
      warnings: targetFaction ? [`进入${FACTIONS[targetFaction].short}境时只凭路引与往来声望`] : [],
    };
  }

  const crew = selectedCrew(game);
  const roles = new Set(crew.map((member) => member.role));
  const localCrew = targetFaction ? crew.filter((member) => game.cities[member.originCityId]?.owner === targetFaction) : [];
  let score = 0;
  const strengths: string[] = [];
  const warnings: string[] = [];
  const add = (value: number, note: string, positive = value > 0) => {
    score += value;
    (positive ? strengths : warnings).push(note);
  };

  if (coverId === "merchant-caravan") {
    if (contract.kind === "cargo") add(2, "货镖与行商身份相合");
    if (contract.patron === "merchant") add(2, "委托人能补齐牙行往来");
    if (game.journey?.tradeLot) add(2, "随车副货可作真实货样");
    if (roles.has("账房")) add(2, "账房能对答税票与货账");
    if (contract.complication === "military") add(-3, "军用镖物不像寻常商货", false);
    if (contract.complication === "wanted") add(-2, "被通缉之人的口音与相貌难藏", false);
    if (contract.patron === "temple") add(-1, "寺院委托缺少商号往来", false);
  } else if (coverId === "pilgrim-party") {
    if (contract.patron === "temple") add(3, "寺院名帖与香册来路完整");
    if (contract.kind === "letter") add(2, "书信可藏入经卷与香册");
    if (contract.kind === "escort") add(1, "护送之人可混入香众");
    if (roles.has("医师")) add(2, "医师药箱能坐实善会身份");
    if (contract.complication === "military") add(-4, "军牒军器经不起香客身份盘问", false);
    if (contract.kind === "cargo" && !game.convoy.upgrades.includes("hidden-compartment")) add(-2, "大宗镖货无暗格可藏", false);
    if (game.journey?.tradeLot) add(-1, "额外商货让香队显得臃肿", false);
  } else if (coverId === "military-train") {
    if (contract.patron === "official") add(2, "官府委托能补足公文格式");
    if (contract.complication === "military") add(3, "军务镖物与递铺身份相合");
    if (contract.kind === "letter") add(1, "急递文书便于藏在军牒中");
    if (roles.has("副镖头")) add(2, "副镖头熟悉军伍号令");
    if (game.originId === "xiangyang-veterans") add(2, "襄阳旧部认得军前规矩");
    if (contract.patron === "jianghu" || contract.patron === "temple") add(-2, "委托来路与军差身份不合", false);
    if (targetFaction && (game.relations[targetFaction] ?? 0) < 0 && !localCrew.length) add(-2, `无人熟悉${FACTIONS[targetFaction].short}军口令`, false);
  }

  if (contract.secretKnown) add(1, "事先查明底细，能针对破绽改牒");
  if (localCrew.length) add(Math.min(2, localCrew.length), `${localCrew.map((member) => member.name).join("、")}熟悉${FACTIONS[targetFaction!].short}境口音与规矩`);
  if (isBorderSensitive(contract) && !contract.secretKnown) add(-1, "敏感镖单尚未查明真实底细", false);

  const fit: TravelCoverFit = score >= 5 ? "strong" : score >= 2 ? "usable" : score >= 0 ? "shaky" : "poor";
  const fitLabel = fit === "strong" ? "严丝合缝" : fit === "usable" ? "基本可信" : fit === "shaky" ? "勉强可用" : "破绽明显";
  return {
    definition,
    targetFaction,
    fit,
    fitLabel,
    score,
    inspectionCover: clamp(0.04 + score * 0.035, -0.04, 0.3),
    strengths,
    warnings,
  };
}
