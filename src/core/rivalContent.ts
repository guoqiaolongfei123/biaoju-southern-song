import { cityById, routeById } from "./data";
import type { GameState, RivalBureauId, RivalBureauState, WorldActor } from "./types";
import type { WorldActorArrival } from "./worldActorContent";

export interface RivalRank {
  seal: string;
  label: string;
  min: number;
  nextAt: number | null;
}

export interface RivalRelation {
  seal: string;
  label: string;
  tone: "hostile" | "wary" | "neutral" | "friendly";
}

export interface RivalBureauView {
  bureau: RivalBureauState;
  actor: WorldActor | null;
  rank: RivalRank;
  relation: RivalRelation;
  position: number;
  routeName: string;
  pathLabel: string;
  progress: number;
  etaDays: number;
}

export interface RivalAdvanceResult {
  bureaus: RivalBureauState[];
  news: string[];
}

const RIVAL_IDS = new Set<RivalBureauId>(["shunfeng-escort", "jiangdong-escort", "shuchuan-escort"]);

const INITIAL_RIVAL_BUREAUS: RivalBureauState[] = [
  {
    id: "shunfeng-escort",
    actorId: "shunfeng-escort",
    name: "顺风镖行",
    seal: "顺",
    homeCityId: "quanzhou",
    specialty: "海舶信镖 · 闽浙水路",
    motto: "潮有早晚，信不误期。",
    reputation: 26,
    relation: 6,
    completedContracts: 4,
    setbacks: 0,
    lastReport: "由福州启程，正护送一匣舶商账册南下。",
    lastReportDay: 1,
  },
  {
    id: "jiangdong-escort",
    actorId: "jiangdong-escort",
    name: "江东忠义行",
    seal: "义",
    homeCityId: "jiankang",
    specialty: "官仓重镖 · 江淮渡口",
    motto: "重车压阵，受托必达。",
    reputation: 38,
    relation: -4,
    completedContracts: 7,
    setbacks: 1,
    lastReport: "从镇江押送官仓铜料，正溯江回建康。",
    lastReportDay: 1,
  },
  {
    id: "shuchuan-escort",
    actorId: "shuchuan-escort",
    name: "蜀川通远行",
    seal: "远",
    homeCityId: "chengdu",
    specialty: "药材活镖 · 秦蜀栈道",
    motto: "山高路窄，也护人归。",
    reputation: 21,
    relation: 12,
    completedContracts: 3,
    setbacks: 0,
    lastReport: "带着利州药商翻上金牛道，脚程尚稳。",
    lastReportDay: 1,
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stableNumber(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function cargoForArrival(arrival: WorldActorArrival, day: number): string {
  const cargo = ["药材", "官仓铜料", "茶引账册", "缄封家书", "海舶契券", "绢帛", "良马文牒"];
  return cargo[stableNumber(`${arrival.actorId}:${arrival.cityId}:${arrival.routeId}:${day}`) % cargo.length];
}

export function createInitialRivalBureaus(): RivalBureauState[] {
  return INITIAL_RIVAL_BUREAUS.map((bureau) => ({ ...bureau }));
}

export function normalizeRivalBureaus(value: unknown): RivalBureauState[] {
  const initial = createInitialRivalBureaus();
  if (!Array.isArray(value)) return initial;
  const byId = new Map(value.flatMap((item): Array<[RivalBureauId, Record<string, unknown>]> => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || !RIVAL_IDS.has(raw.id as RivalBureauId)) return [];
    return [[raw.id as RivalBureauId, raw]];
  }));
  return initial.map((fallback) => {
    const raw = byId.get(fallback.id);
    if (!raw) return fallback;
    return {
      ...fallback,
      reputation: clamp(typeof raw.reputation === "number" ? raw.reputation : fallback.reputation, 0, 100),
      relation: clamp(typeof raw.relation === "number" ? raw.relation : fallback.relation, -60, 60),
      completedContracts: Math.max(0, Math.floor(typeof raw.completedContracts === "number" ? raw.completedContracts : fallback.completedContracts)),
      setbacks: Math.max(0, Math.floor(typeof raw.setbacks === "number" ? raw.setbacks : fallback.setbacks)),
      lastReport: typeof raw.lastReport === "string" ? raw.lastReport : fallback.lastReport,
      lastReportDay: Math.max(1, Math.floor(typeof raw.lastReportDay === "number" ? raw.lastReportDay : fallback.lastReportDay)),
    };
  });
}

export function rivalRank(reputation: number): RivalRank {
  if (reputation >= 70) return { seal: "雄", label: "一方雄行", min: 70, nextAt: null };
  if (reputation >= 45) return { seal: "名", label: "名闻数路", min: 45, nextAt: 70 };
  if (reputation >= 24) return { seal: "熟", label: "熟旗通路", min: 24, nextAt: 45 };
  return { seal: "初", label: "新旗试路", min: 0, nextAt: 24 };
}

export function rivalRelation(relation: number): RivalRelation {
  if (relation <= -20) return { seal: "争", label: "争道旧怨", tone: "hostile" };
  if (relation < 5) return { seal: "防", label: "彼此提防", tone: "wary" };
  if (relation < 25) return { seal: "识", label: "点头相识", tone: "neutral" };
  return { seal: "盟", label: "可托后背", tone: "friendly" };
}

export function rivalBureauByActor(game: Pick<GameState, "rivalBureaus">, actorId: string | undefined): RivalBureauState | null {
  return game.rivalBureaus.find((bureau) => bureau.actorId === actorId) ?? null;
}

export function updateRivalRelation(
  bureaus: readonly RivalBureauState[],
  actorId: string,
  delta: number,
  day: number,
  report?: string,
): RivalBureauState[] {
  return bureaus.map((bureau) => bureau.actorId === actorId ? {
    ...bureau,
    relation: clamp(bureau.relation + delta, -60, 60),
    lastReport: report ?? bureau.lastReport,
    lastReportDay: report ? day : bureau.lastReportDay,
  } : bureau);
}

export function advanceRivalBureaus(
  source: readonly RivalBureauState[],
  arrivals: readonly WorldActorArrival[],
  targetDay: number,
): RivalAdvanceResult {
  let bureaus = normalizeRivalBureaus(source);
  const news: string[] = [];
  for (const arrival of arrivals) {
    const index = bureaus.findIndex((bureau) => bureau.actorId === arrival.actorId);
    if (index < 0) continue;
    const previous = bureaus[index];
    const route = routeById(arrival.routeId);
    const city = cityById(arrival.cityId);
    const cargo = cargoForArrival(arrival, targetDay);
    const setbackThreshold = Math.max(5, Math.min(26, Math.round((route.danger - 38) * .42)));
    const setback = stableNumber(`${arrival.actorId}:${arrival.routeId}:${arrival.cityId}:${targetDay}`) % 100 < setbackThreshold;
    const gain = route.danger >= 64 ? 3 : route.danger >= 44 ? 2 : 1;
    const oldRank = rivalRank(previous.reputation);
    const next: RivalBureauState = setback ? {
      ...previous,
      reputation: clamp(previous.reputation - 1, 0, 100),
      setbacks: previous.setbacks + 1,
      lastReport: `护送${cargo}经过${route.name}时受阻，虽保住镖物，却误了交割脚程。`,
      lastReportDay: targetDay,
    } : {
      ...previous,
      reputation: clamp(previous.reputation + gain, 0, 100),
      completedContracts: previous.completedContracts + 1,
      lastReport: `护送${cargo}走完${route.name}，已在${city.name}照约交割。`,
      lastReportDay: targetDay,
    };
    bureaus = bureaus.map((bureau, bureauIndex) => bureauIndex === index ? next : bureau);
    const nextRank = rivalRank(next.reputation);
    if (news.length === 0 && setback) news.push(`【同行失期】${next.name}走${route.name}受阻，江湖名帖退了一笔。`);
    else if (news.length === 0 && oldRank.label !== nextRank.label) news.push(`【天下镖行榜】${next.name}在${city.name}交成一镖，升入「${nextRank.label}」。`);
  }
  return { bureaus, news };
}

export function rivalBureauViews(game: Pick<GameState, "rivalBureaus" | "worldActors">): RivalBureauView[] {
  const actorById = new Map(game.worldActors.map((actor) => [actor.id, actor]));
  const sorted = [...game.rivalBureaus].sort((left, right) => right.reputation - left.reputation || right.completedContracts - left.completedContracts || left.id.localeCompare(right.id));
  return sorted.map((bureau, index) => {
    const actor = actorById.get(bureau.actorId) ?? null;
    const route = actor ? routeById(actor.routeId) : null;
    return {
      bureau,
      actor,
      rank: rivalRank(bureau.reputation),
      relation: rivalRelation(bureau.relation),
      position: index + 1,
      routeName: route?.name ?? "行踪未明",
      pathLabel: actor ? `${cityById(actor.fromCityId).name} → ${cityById(actor.toCityId).name}` : "尚无近报",
      progress: actor ? Math.round(actor.progress * 100) : 0,
      etaDays: actor && route ? Math.max(1, Math.ceil((1 - actor.progress) * route.days)) : 0,
    };
  });
}
