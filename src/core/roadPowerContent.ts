import { CITIES, routeById } from "./data";
import type { RoadInfluenceOutcome, RouteDefinition, RouteState, RouteTerrain } from "./types";

export type RoadPowerRegion = "north" | "northwest" | "jianghuai" | "jiangnan" | "jinghu" | "southwest" | "lingnan";
export type RoadInfluenceTone = "quiet" | "watched" | "hot" | "pact" | "suppressed";

export interface RoadPowerDefinition {
  name: string;
  seal: string;
  region: RoadPowerRegion;
  description: string;
}

export interface RoadInfluenceSnapshot {
  power: RoadPowerDefinition;
  pressure: number;
  passageUntilDay: number;
  suppressedUntilDay: number;
  passageActive: boolean;
  suppressedActive: boolean;
  lastOutcome: RoadInfluenceOutcome | null;
  lastDay: number;
  label: string;
  seal: string;
  note: string;
  tone: RoadInfluenceTone;
  dangerModifier: number;
  effectiveUntilDay: number | null;
}

const POWER_NAMES: Record<RoadPowerRegion, Record<RouteTerrain, Omit<RoadPowerDefinition, "region">>> = {
  north: {
    official: { name: "太行青旗寨", seal: "青", description: "控制河北驿道脚店与山口眼线，最看重过路字号。" },
    mountain: { name: "井陉黑松寨", seal: "松", description: "熟知太行陉口与断崖小径，惯在车队下坡时截路。" },
    river: { name: "河朔水棚", seal: "河", description: "沿黄河渡汛与芦苇荡活动，手里常有真假渡牌。" },
  },
  northwest: {
    official: { name: "关陇马帮", seal: "马", description: "往来关中与河西，以驼马、向导和沿途保票立足。" },
    mountain: { name: "秦岭赤崖寨", seal: "崖", description: "盘踞栈道与山口，能封绝壁，也能替熟客领一条暗路。" },
    river: { name: "湟河筏社", seal: "筏", description: "把持峡河筏渡，消息跟着皮筏在西北诸道间流动。" },
  },
  jianghuai: {
    official: { name: "淮上飞鹞寨", seal: "鹞", description: "在宋金交界认旗认牒，既收买路银，也替人递边报。" },
    mountain: { name: "伏牛义寨", seal: "牛", description: "藏在京西山路，擅用滚木与假路标截住长车。" },
    river: { name: "采石矶水寨", seal: "矶", description: "熟悉长江津渡与沿岸暗汊，能扣船，也能押船过险滩。" },
  },
  jiangnan: {
    official: { name: "天目青竹社", seal: "竹", description: "眼线散在江南茶棚与脚店，少动刀，更在意长期路契。" },
    mountain: { name: "仙霞岭寨", seal: "霞", description: "占住浙闽山口，熟识商旅货色与每一条挑夫小径。" },
    river: { name: "太湖排帮", seal: "排", description: "船户遍及太湖与运河水网，一纸水路保票可通数处埠头。" },
  },
  jinghu: {
    official: { name: "荆襄插旗会", seal: "旗", description: "在荆湖官道两侧结寨，常借战乱截军需与富商长车。" },
    mountain: { name: "武陵伏虎寨", seal: "虎", description: "盘踞峡口密林，擅长诱车入窄路后首尾齐断。" },
    river: { name: "洞庭九舵", seal: "舵", description: "九处船帮共认一面舵旗，能放行，也能让整片湖汊无船可雇。" },
  },
  southwest: {
    official: { name: "蜀南青羌会", seal: "羌", description: "联络驮队与寨堡，为熟客开茶马路，也会向生旗索重礼。" },
    mountain: { name: "剑门石燕寨", seal: "燕", description: "守着蜀道险栈，惯从崖顶盯住车队辕马与护尾人手。" },
    river: { name: "巴峡九舵", seal: "峡", description: "把持峡江滩口与纤路，船过哪一道险滩都瞒不过其耳目。" },
  },
  lingnan: {
    official: { name: "五岭联寨", seal: "岭", description: "跨岭各寨互认口信，货从北江到海埠都可能遇见同一套暗号。" },
    mountain: { name: "大庾梅关寨", seal: "梅", description: "熟知岭口雾路与挑夫行踪，最善截断前哨再围住镖车。" },
    river: { name: "南海潮帮", seal: "潮", description: "沿闽粤海路与江口活动，既护航商舶，也收无票船只的过水钱。" },
  },
};

function regionForRoute(route: RouteDefinition): RoadPowerRegion {
  const from = CITIES.find((city) => city.id === route.from)!;
  const to = CITIES.find((city) => city.id === route.to)!;
  const lon = (from.lon + to.lon) / 2;
  const lat = (from.lat + to.lat) / 2;
  if (lat >= 34.2 && lon >= 110.5) return "north";
  if (lat >= 31.8 && lon < 110.5) return "northwest";
  if (lat < 25.5 && lon >= 104) return "lingnan";
  if (lon < 106.5 && lat < 32.2) return "southwest";
  if (lon >= 116 && lat < 31.8) return "jiangnan";
  if (lon < 116 && lat < 31.8) return "jinghu";
  return "jianghuai";
}

export function roadPowerForRoute(routeId: string): RoadPowerDefinition {
  const route = routeById(routeId);
  const region = regionForRoute(route);
  return { ...POWER_NAMES[region][route.terrain], region };
}

export function baseBanditPressure(routeId: string): number {
  const route = routeById(routeId);
  const terrainWeight = route.terrain === "mountain" ? 8 : route.terrain === "river" ? 4 : 0;
  return Math.max(18, Math.min(76, Math.round(route.danger * .68 + terrainWeight)));
}

export function normalizeRouteInfluence(routeId: string, state: RouteState | undefined) {
  const base = baseBanditPressure(routeId);
  return {
    pressure: Math.max(0, Math.min(100, Math.round(typeof state?.banditPressure === "number" ? state.banditPressure : base))),
    passageUntilDay: Math.max(0, Math.round(typeof state?.passageUntilDay === "number" ? state.passageUntilDay : 0)),
    suppressedUntilDay: Math.max(0, Math.round(typeof state?.suppressedUntilDay === "number" ? state.suppressedUntilDay : 0)),
    lastOutcome: state?.lastBanditOutcome ?? null,
    lastDay: Math.max(0, Math.round(typeof state?.lastBanditDay === "number" ? state.lastBanditDay : 0)),
  };
}

export function roadInfluenceSnapshot(routeId: string, state: RouteState | undefined, day: number): RoadInfluenceSnapshot {
  const power = roadPowerForRoute(routeId);
  const influence = normalizeRouteInfluence(routeId, state);
  const passageActive = influence.passageUntilDay >= day;
  const suppressedActive = !passageActive && influence.suppressedUntilDay >= day;
  if (passageActive) return {
    power, ...influence, passageActive, suppressedActive, label: "寨契通行", seal: "契", tone: "pact",
    note: `${power.name}认得风云行的过路封签，本路暂不再索买路钱。`, dangerModifier: -12, effectiveUntilDay: influence.passageUntilDay,
  };
  if (suppressedActive) return {
    power, ...influence, passageActive, suppressedActive, label: "余众蛰伏", seal: "靖", tone: "suppressed",
    note: `${power.name}刚吃过亏，暗哨暂时不敢正面拦旗。`, dangerModifier: -18, effectiveUntilDay: influence.suppressedUntilDay,
  };
  if (influence.pressure >= 70) return {
    power, ...influence, passageActive, suppressedActive, label: "匪势猖獗", seal: "劫", tone: "hot",
    note: `${power.name}哨卡密布，专盯长车、活镖与落单商旅。`, dangerModifier: 9, effectiveUntilDay: null,
  };
  if (influence.pressure >= 46) return {
    power, ...influence, passageActive, suppressedActive, label: "暗哨盯路", seal: "哨", tone: "watched",
    note: `${power.name}仍在沿路查旗号，遇见陌生车队便会试探。`, dangerModifier: 5, effectiveUntilDay: null,
  };
  return {
    power, ...influence, passageActive, suppressedActive, label: "路面清静", seal: "安", tone: "quiet",
    note: `${power.name}眼下人手稀疏，剪径风险暂低。`, dangerModifier: influence.pressure >= 28 ? 2 : 0, effectiveUntilDay: null,
  };
}

export function updateRouteInfluence(
  routeId: string,
  state: RouteState,
  day: number,
  changes: { pressureDelta?: number; passageUntilDay?: number; suppressedUntilDay?: number; outcome: RoadInfluenceOutcome },
): RouteState {
  const current = normalizeRouteInfluence(routeId, state);
  return {
    ...state,
    banditPressure: Math.max(0, Math.min(100, current.pressure + (changes.pressureDelta ?? 0))),
    passageUntilDay: changes.passageUntilDay ?? current.passageUntilDay,
    suppressedUntilDay: changes.suppressedUntilDay ?? current.suppressedUntilDay,
    lastBanditOutcome: changes.outcome,
    lastBanditDay: day,
  };
}
