import { cityById } from "./data";
import type { CityState, TradeGoodId, TradeLot } from "./types";

export type TradeGoodCategory = "luxury" | "staple" | "military" | "medicine";

export interface TradeGoodDefinition {
  id: TradeGoodId;
  name: string;
  seal: string;
  description: string;
  basePrice: number;
  category: TradeGoodCategory;
  producerCityIds: string[];
}

export const TRADE_GOODS: Record<TradeGoodId, TradeGoodDefinition> = {
  silk: { id: "silk", name: "江南绫罗", seal: "帛", description: "轻而值重，富城与边镇都有人收。", basePrice: 24, category: "luxury", producerCityIds: ["pingjiang", "jiaxing", "huzhou", "chengdu"] },
  tea: { id: "tea", name: "团焙新茶", seal: "茶", description: "怕潮怕火，走得越远越见价。", basePrice: 18, category: "staple", producerCityIds: ["huzhou", "jianning", "fuzhou", "quanzhou", "chengdu"] },
  salt: { id: "salt", name: "淮浙盐引", seal: "鹽", description: "民生日用，也是关卡最爱细查的货。", basePrice: 17, category: "staple", producerCityIds: ["yangzhou", "zhenjiang", "qingyuan", "quanzhou"] },
  spice: { id: "spice", name: "舶来香药", seal: "香", description: "海港来货，内陆富户与药铺争相收买。", basePrice: 32, category: "luxury", producerCityIds: ["qingyuan", "quanzhou", "guangzhou", "qinzhou"] },
  ironware: { id: "ironware", name: "熟铁器具", seal: "鐵", description: "农具可用、军营也收，乱世尤其紧俏。", basePrice: 27, category: "military", producerCityIds: ["taiyuan", "jingzhao", "jiankang", "xiangyang"] },
  grain: { id: "grain", name: "湖广粮米", seal: "粟", description: "本钱不重，遇上军镇和荒城却能救急。", basePrice: 14, category: "staple", producerCityIds: ["changzhou", "jiaxing", "ezhou", "yuezhou", "tanzhou"] },
  books: { id: "books", name: "版刻书画", seal: "卷", description: "行在与书坊的精细货，最怕水火折损。", basePrice: 22, category: "luxury", producerCityIds: ["linan", "pingjiang", "shaoxing", "chengdu"] },
  medicine: { id: "medicine", name: "山场药材", seal: "藥", description: "山路采买的干药，疫城与军镇都急需。", basePrice: 25, category: "medicine", producerCityIds: ["wuzhou", "jianning", "fuzhou", "chengdu", "dali"] },
  hide: { id: "hide", name: "北地皮货", seal: "革", description: "毡裘、皮甲皆能用，南方少见。", basePrice: 29, category: "military", producerCityIds: ["yanjing", "datong", "taiyuan", "xingqing", "liangzhou"] },
};

export const TRADE_GOOD_LIST = Object.values(TRADE_GOODS);

function stableIndex(cityId: string, day: number, seed: number, length: number): number {
  let hash = (seed ^ (day * 2654435761)) >>> 0;
  for (let index = 0; index < cityId.length; index += 1) hash = Math.imul(hash ^ cityId.charCodeAt(index), 16777619) >>> 0;
  return length ? hash % length : 0;
}

export function localTradeGood(cityId: string, day: number, seed: number): TradeGoodDefinition | null {
  const local = TRADE_GOOD_LIST.filter((good) => good.producerCityIds.includes(cityId));
  return local.length ? local[stableIndex(cityId, day, seed, local.length)] : null;
}

function statusDemand(good: TradeGoodDefinition, status: CityState["status"]): number {
  if (status === "famine") return good.id === "grain" ? 2.2 : good.id === "salt" ? 1.62 : good.category === "medicine" ? 1.28 : good.category === "luxury" ? .72 : 1.14;
  if (status === "plague") return good.category === "medicine" ? 2.25 : good.id === "spice" ? 1.58 : good.id === "tea" ? 1.2 : good.category === "luxury" ? .78 : 1.08;
  if (status === "besieged" || status === "contested") return good.category === "military" ? 1.72 : good.id === "grain" ? 1.82 : good.id === "salt" ? 1.45 : good.category === "medicine" ? 1.42 : .78;
  if (status === "martial" || status === "tense") return good.category === "military" ? 1.46 : good.id === "grain" || good.id === "salt" ? 1.24 : 1.02;
  if (status === "captured") return good.category === "luxury" ? .86 : good.category === "military" || good.category === "medicine" ? 1.34 : 1.2;
  if (status === "disrupted") return good.category === "staple" ? 1.38 : 1.2;
  if (status === "prosperous") return good.category === "luxury" ? 1.3 : good.category === "medicine" ? 1.08 : .96;
  if (status === "autonomous") return good.category === "military" ? 1.2 : 1.02;
  return 1;
}

export function tradeDemandMultiplier(goodId: TradeGoodId, destinationCityId: string, destination: CityState, travelDays: number): number {
  const good = TRADE_GOODS[goodId];
  const distance = 1 + Math.min(.52, Math.max(1, travelDays) * .032);
  const localSupply = good.producerCityIds.includes(destinationCityId) ? .72 : 1;
  return distance * localSupply * statusDemand(good, destination.status);
}

export function tradeSaleValue(lot: TradeLot, destinationCityId: string, destination: CityState, travelDays: number, cargoIntegrity: number): number {
  const good = TRADE_GOODS[lot.goodId];
  const condition = Math.max(0, Math.min(1, cargoIntegrity / 100));
  return Math.max(0, Math.round(good.basePrice * tradeDemandMultiplier(lot.goodId, destinationCityId, destination, travelDays) * condition));
}

export function tradeDemandLabel(goodId: TradeGoodId, destinationCityId: string, destination: CityState): string {
  const good = TRADE_GOODS[goodId];
  if (good.producerCityIds.includes(destinationCityId)) return `${cityById(destinationCityId).name}同货充足，行情偏低`;
  if (destination.status === "famine" && (good.id === "grain" || good.id === "salt")) return "荒情催价，民生日用急缺";
  if (destination.status === "plague" && good.category === "medicine") return "疫气蔓延，药铺争货";
  if (["besieged", "contested", "martial", "tense"].includes(destination.status) && good.category === "military") return "军镇急需，营寨高价收货";
  if (destination.status === "prosperous" && good.category === "luxury") return "富城竞买，精细货走俏";
  if (destination.status === "captured") return "易主初定，市价浮动极大";
  return "异地行栈照路程加价收货";
}
