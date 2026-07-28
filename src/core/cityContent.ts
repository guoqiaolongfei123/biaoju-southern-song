import type { CityStandingTier, CityState, CityStatus } from "./types";

export interface CityStandingEffect {
  tier: CityStandingTier;
  label: string;
  seal: string;
  description: string;
  priceMultiplier: number;
  rewardMultiplier: number;
  contractModifier: number;
  recruitQuality: number;
  nextAt: number | null;
}

export const CITY_STANDING_EFFECTS: Record<CityStandingTier, CityStandingEffect> = {
  stranger: { tier: "stranger", label: "初来乍到", seal: "生", description: "牙人只认现银，寻常商户还不肯把要紧镖物交出来。", priceMultiplier: 1, rewardMultiplier: 1, contractModifier: 0, recruitQuality: 0, nextAt: 10 },
  known: { tier: "known", label: "坊间识面", seal: "识", description: "脚店与牙行认得风云行的旗号，整备时会少算一点客价。", priceMultiplier: .97, rewardMultiplier: 1.03, contractModifier: 0, recruitQuality: 0, nextAt: 25 },
  trusted: { tier: "trusted", label: "一城信重", seal: "信", description: "大户愿把内情相告，镖榜更丰，也有熟手主动登门。", priceMultiplier: .92, rewardMultiplier: 1.08, contractModifier: 1, recruitQuality: 1, nextAt: 50 },
  pillar: { tier: "pillar", label: "一方柱石", seal: "望", description: "风云行已是本地商路的一块招牌，市井、官府与江湖都肯卖人情。", priceMultiplier: .86, rewardMultiplier: 1.14, contractModifier: 1, recruitQuality: 2, nextAt: null },
};

export function cityStanding(score: number): CityStandingEffect {
  if (score >= 50) return CITY_STANDING_EFFECTS.pillar;
  if (score >= 25) return CITY_STANDING_EFFECTS.trusted;
  if (score >= 10) return CITY_STANDING_EFFECTS.known;
  return CITY_STANDING_EFFECTS.stranger;
}

export function cityStandingProgress(score: number): { floor: number; ceiling: number; percent: number } {
  const effect = cityStanding(score);
  const floor = effect.tier === "pillar" ? 50 : effect.tier === "trusted" ? 25 : effect.tier === "known" ? 10 : 0;
  const ceiling = effect.nextAt ?? 70;
  return { floor, ceiling, percent: Math.max(0, Math.min(100, ((score - floor) / Math.max(1, ceiling - floor)) * 100)) };
}

export interface CityStatusEffect {
  label: string;
  seal: string;
  description: string;
  marketNote: string;
  priceMultiplier: number;
  supplyMultiplier: number;
  healMultiplier: number;
  rewardMultiplier: number;
  contractModifier: number;
  recruitCount: number;
  recruitQuality: number;
  danger: number;
}

export const CITY_STATUS_EFFECTS: Record<CityStatus, CityStatusEffect> = {
  prosperous: { label: "商旅辐辏", seal: "盛", description: "仓廪充实，行栈与牙人争相揽客，消息和好手都来得快。", marketNote: "货足价平 · 人才汇聚", priceMultiplier: .9, supplyMultiplier: .82, healMultiplier: .9, rewardMultiplier: .96, contractModifier: 1, recruitCount: 4, recruitQuality: 2, danger: -2 },
  stable: { label: "城中安定", seal: "安", description: "衙门照常点卯，市井供需平稳，各路关牒仍可通行。", marketNote: "市价平稳 · 镖榜如常", priceMultiplier: 1, supplyMultiplier: 1, healMultiplier: 1, rewardMultiplier: 1, contractModifier: 0, recruitCount: 3, recruitQuality: 0, danger: 0 },
  tense: { label: "边声渐紧", seal: "警", description: "城门盘查加严，军需与密札渐多，寻常商旅不敢久留。", marketNote: "整备略贵 · 军情镖增", priceMultiplier: 1.08, supplyMultiplier: 1.16, healMultiplier: 1.05, rewardMultiplier: 1.14, contractModifier: 0, recruitCount: 3, recruitQuality: 0, danger: 4 },
  besieged: { label: "围城风声", seal: "圍", description: "城外烽火连营，粮车和药材寸步难行，能进城的镖都值重金。", marketNote: "粮价腾贵 · 急镖重酬", priceMultiplier: 1.32, supplyMultiplier: 1.78, healMultiplier: 1.34, rewardMultiplier: 1.36, contractModifier: -1, recruitCount: 2, recruitQuality: 0, danger: 10 },
  captured: { label: "易主初定", seal: "易", description: "新旗已上城头，旧关牒多半作废，官差与黑市同时活跃。", marketNote: "旧牒作废 · 暗镖增多", priceMultiplier: 1.24, supplyMultiplier: 1.34, healMultiplier: 1.2, rewardMultiplier: 1.24, contractModifier: 0, recruitCount: 2, recruitQuality: -1, danger: 7 },
  famine: { label: "仓廪告急", seal: "饑", description: "谷价一日三涨，城门外尽是流民，任何一袋粮都能救命。", marketNote: "粮价翻倍 · 救荒镖急", priceMultiplier: 1.3, supplyMultiplier: 2.05, healMultiplier: 1.18, rewardMultiplier: 1.3, contractModifier: -1, recruitCount: 2, recruitQuality: -1, danger: 7 },
  plague: { label: "疫气蔓延", seal: "疫", description: "药铺闭门惜售，里坊相互戒备，医者与药材比银钱更难得。", marketNote: "药价高昂 · 医药镖急", priceMultiplier: 1.22, supplyMultiplier: 1.28, healMultiplier: 1.68, rewardMultiplier: 1.32, contractModifier: -1, recruitCount: 2, recruitQuality: -1, danger: 6 },
  disrupted: { label: "商路断续", seal: "阻", description: "桥渡与驿站时开时闭，积压的货单给价丰厚，却未必走得出去。", marketNote: "货栈缺货 · 积镖加价", priceMultiplier: 1.18, supplyMultiplier: 1.43, healMultiplier: 1.12, rewardMultiplier: 1.27, contractModifier: 0, recruitCount: 2, recruitQuality: 0, danger: 8 },
  martial: { label: "军府戒严", seal: "禁", description: "夜禁与盘查覆盖全城，官差强势，军府委托占了大半镖榜。", marketNote: "盘查森严 · 官镖增多", priceMultiplier: 1.14, supplyMultiplier: 1.2, healMultiplier: 1.13, rewardMultiplier: 1.2, contractModifier: 0, recruitCount: 3, recruitQuality: 0, danger: 6 },
  contested: { label: "两军争城", seal: "戰", description: "城郊旗号朝夕数变，牙人与关吏都不敢担保明日的路还通。", marketNote: "百业停顿 · 风险重酬", priceMultiplier: 1.38, supplyMultiplier: 1.58, healMultiplier: 1.4, rewardMultiplier: 1.42, contractModifier: -1, recruitCount: 2, recruitQuality: 0, danger: 12 },
  autonomous: { label: "豪强自守", seal: "寨", description: "本地大族自筹乡兵，规矩不同于官府，却能护住一方商路。", marketNote: "私约盛行 · 地头熟手", priceMultiplier: 1.04, supplyMultiplier: 1.02, healMultiplier: 1.03, rewardMultiplier: 1.1, contractModifier: 0, recruitCount: 3, recruitQuality: 1, danger: 3 },
};

export function cityStatusEffect(city: CityState): CityStatusEffect {
  return CITY_STATUS_EFFECTS[city.status];
}

export function cityServiceMultiplier(status: CityStatus, service: "supplies" | "repair" | "heal" | "intel" | "stable"): number {
  const effect = CITY_STATUS_EFFECTS[status];
  if (service === "supplies") return effect.supplyMultiplier;
  if (service === "heal") return effect.healMultiplier;
  return effect.priceMultiplier;
}

export function citySupplyAmount(status: CityStatus): number {
  if (status === "famine") return 3;
  if (status === "besieged" || status === "contested") return 4;
  if (status === "plague" || status === "disrupted" || status === "captured") return 5;
  if (status === "prosperous") return 8;
  return 6;
}

export function contractCountForCity(city: CityState, hasMajorOffice: boolean, localReputation = 0): number {
  return Math.max(2, Math.min(5, (hasMajorOffice ? 4 : 3) + cityStatusEffect(city).contractModifier + cityStanding(localReputation).contractModifier));
}

export function cityConditionAge(city: CityState, day: number): number {
  return Math.max(0, day - city.statusSinceDay);
}
