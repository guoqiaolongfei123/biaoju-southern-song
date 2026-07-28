import type {
  Contract,
  ConvoyUpgradeId,
  CrewRole,
  RouteTerrain,
  SpecialHandlingId,
  TravelStance,
} from "./types";
import type { RegionalWeather } from "./weatherContent";

export interface SpecialHandlingDefinition {
  id: SpecialHandlingId;
  seal: string;
  name: string;
  summary: string;
  rule: string;
  counterplay: string;
  gaugeLabel: string;
  lateRate: number;
  lossDivisor: number;
  sealPenalty: number;
}

export const SPECIAL_HANDLINGS: Record<SpecialHandlingId, SpecialHandlingDefinition> = {
  "cold-chain": {
    id: "cold-chain",
    seal: "寒",
    name: "冷藏通风",
    summary: "暑热和长途会持续损伤镖物，不必遇敌也可能坏货。",
    rule: "每段路按天候与脚程结算自然货损；暑热最险，暴雨次之。",
    counterplay: "带医师、厨子或浸矾篷布可减损；优先短途与凉爽路线。",
    gaugeLabel: "保鲜",
    lateRate: 0.1,
    lossDivisor: 105,
    sealPenalty: 0.3,
  },
  solemn: {
    id: "solemn",
    seal: "柩",
    name: "归柩禁验",
    summary: "棺木不可开验，跨境关卡会把礼制变成政治风险。",
    rule: "此镖视作敏感镖物；边关与易旗交割会额外抬高风险。",
    counterplay: "先查明底细，带账房并准备香客身份；暗格不能代替合法路引。",
    gaugeLabel: "棺封",
    lateRate: 0.11,
    lossDivisor: 96,
    sealPenalty: 0.5,
  },
  appointed: {
    id: "appointed",
    seal: "刻",
    name: "刻时交付",
    summary: "差一日也算误约，报酬对迟到比普通货镖敏感得多。",
    rule: "每迟一日扣减 20% 基础镖酬，五日后此镖几乎失去价值。",
    counterplay: "轻车快马、熟路和疾行更有价值；接镖前先看余限。",
    gaugeLabel: "时契",
    lateRate: 0.2,
    lossDivisor: 135,
    sealPenalty: 0.28,
  },
  tracked: {
    id: "tracked",
    seal: "踪",
    name: "引势追踪",
    summary: "镖物会引来特定势力，遭袭时敌势明显强于普通货镖。",
    rule: "沿途战斗危险上升；公开亮旗时增幅最大。",
    counterplay: "偃旗潜行与暗格夹层可叠加削弱追踪，但不能完全消除。",
    gaugeLabel: "匿踪",
    lateRate: 0.1,
    lossDivisor: 112,
    sealPenalty: 0.4,
  },
};

export interface SpecialTravelSegment {
  days: number;
  terrain: RouteTerrain;
  weather: RegionalWeather;
}

export interface SpecialTravelContext {
  stance: TravelStance;
  crewRoles: readonly CrewRole[];
  upgrades: readonly ConvoyUpgradeId[];
  segments: readonly SpecialTravelSegment[];
  borderSegments: number;
  deadlineMargin: number;
}

export interface SpecialTravelForecast {
  definition: SpecialHandlingDefinition;
  dangerModifier: number;
  estimatedCargoLoss: number;
  pressure: number;
  note: string;
}

export function specialHandlingById(id?: SpecialHandlingId): SpecialHandlingDefinition | null {
  return id ? SPECIAL_HANDLINGS[id] : null;
}

export function specialHandlingForContract(contract?: Contract | null): SpecialHandlingDefinition | null {
  return specialHandlingById(contract?.specialHandlingId);
}

function hasRole(context: Pick<SpecialTravelContext, "crewRoles">, role: CrewRole): boolean {
  return context.crewRoles.includes(role);
}

function hasUpgrade(context: Pick<SpecialTravelContext, "upgrades">, upgrade: ConvoyUpgradeId): boolean {
  return context.upgrades.includes(upgrade);
}

export function coldChainSegmentDamage(
  contract: Contract,
  segment: SpecialTravelSegment,
  context: Pick<SpecialTravelContext, "crewRoles" | "upgrades">,
): number {
  if (contract.specialHandlingId !== "cold-chain") return 0;
  const weatherDamage = segment.weather.kind === "heat"
    ? 4 + segment.weather.severity * 2
    : segment.weather.kind === "storm"
      ? 4
      : segment.weather.kind === "rain" || segment.weather.kind === "fog"
        ? 2
        : segment.weather.kind === "clear" && segment.weather.season === "summer"
          ? 2
          : 0;
  const durationDamage = Math.max(0, segment.days - 2);
  const terrainDamage = segment.terrain === "river" && ["rain", "storm", "fog"].includes(segment.weather.kind) ? 1 : 0;
  const mitigation = (hasRole(context, "医师") ? 3 : 0)
    + (hasRole(context, "厨子") ? 1 : 0)
    + (hasUpgrade(context, "fireproof-awning") ? 3 : 0);
  return Math.max(0, Math.round(weatherDamage + durationDamage + terrainDamage - mitigation));
}

export function specialTravelForecast(contract: Contract, context: SpecialTravelContext): SpecialTravelForecast | null {
  const definition = specialHandlingForContract(contract);
  if (!definition) return null;
  const estimatedCargoLoss = context.segments.reduce(
    (sum, segment) => sum + coldChainSegmentDamage(contract, segment, context),
    0,
  );
  let dangerModifier = 0;
  let pressure = estimatedCargoLoss * 1.8;
  let note = definition.rule;

  if (definition.id === "cold-chain") {
    note = estimatedCargoLoss > 0
      ? `按当前天候预计自然货损约 ${estimatedCargoLoss}%` 
      : "当前路线天候适宜，预计无自然货损";
  } else if (definition.id === "solemn") {
    dangerModifier = context.borderSegments > 0 ? 6 : 1;
    pressure += context.borderSegments * 12;
    note = context.borderSegments > 0 ? `将过 ${context.borderSegments} 处边关，开棺查验风险显著` : "此路不跨境，礼制风险较低";
  } else if (definition.id === "appointed") {
    pressure += Math.max(0, 3 - context.deadlineMargin) * 10;
    note = context.deadlineMargin >= 3 ? `预计早到 ${context.deadlineMargin} 日` : context.deadlineMargin >= 0 ? `仅余 ${context.deadlineMargin} 日缓冲` : `预计迟到 ${Math.abs(context.deadlineMargin)} 日`;
  } else if (definition.id === "tracked") {
    dangerModifier = 12 - (context.stance === "covert" ? 5 : 0) - (hasUpgrade(context, "hidden-compartment") ? 4 : 0);
    pressure += dangerModifier * 1.7;
    note = dangerModifier <= 4 ? "潜行与暗格已大幅削弱追踪" : context.stance === "covert" || hasUpgrade(context, "hidden-compartment") ? "已有匿踪准备，但仍会引来追兵" : "公开行镖会显著增强沿途敌势";
  }

  return { definition, dangerModifier, estimatedCargoLoss, pressure, note };
}

export function specialSettlementRates(contract: Contract): Pick<SpecialHandlingDefinition, "lateRate" | "lossDivisor" | "sealPenalty"> | null {
  const definition = specialHandlingForContract(contract);
  return definition ? { lateRate: definition.lateRate, lossDivisor: definition.lossDivisor, sealPenalty: definition.sealPenalty } : null;
}

export function specialBattleDangerModifier(
  contract: Contract,
  stance: TravelStance,
  upgrades: readonly ConvoyUpgradeId[],
): number {
  if (contract.specialHandlingId === "tracked") {
    return Math.max(3, 12 - (stance === "covert" ? 5 : 0) - (upgrades.includes("hidden-compartment") ? 4 : 0));
  }
  if (contract.specialHandlingId === "solemn") return 2;
  return 0;
}
