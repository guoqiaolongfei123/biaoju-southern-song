import { ROUTES, cityById, otherCity, routeById } from "./data";
import { factionsAtWar } from "./frontlineContent";
import { pickRandom } from "./rng";
import type { CityState, FactionId, RouteDefinition, WorldActor, WorldActorKind } from "./types";

const ACTOR_SPEED: Record<WorldActorKind, number> = {
  merchant: 0.82,
  patrol: 1.18,
  rival: 1,
  army: 0.68,
};

const FACTION_IDS = new Set<FactionId>(["song", "jin", "xixia", "dali", "tibetan", "mongol", "neutral"]);
const ACTOR_KINDS = new Set<WorldActorKind>(["merchant", "patrol", "rival", "army"]);
const INDEPENDENT_ROUTE_ACTORS = new Set(["jiangdong-escort", "shuchuan-escort"]);

function independentRouteIndex(actorId: string, arrival: number, candidateCount: number): number {
  let value = arrival * 131;
  for (let index = 0; index < actorId.length; index += 1) value = Math.imul(value ^ actorId.charCodeAt(index), 16777619);
  return (value >>> 0) % candidateCount;
}

const INITIAL_WORLD_ACTORS: WorldActor[] = [
  { id: "liangzhe-salt", name: "两浙盐纲", kind: "merchant", faction: "neutral", routeId: "linan-jiankang", fromCityId: "linan", toCityId: "jiankang", progress: 0.22 },
  { id: "jiangnan-tea", name: "江南茶帮", kind: "merchant", faction: "neutral", routeId: "jiankang-ezhou", fromCityId: "jiankang", toCityId: "ezhou", progress: 0.57 },
  { id: "jinghu-patrol", name: "京湖巡骑", kind: "patrol", faction: "song", routeId: "xiangyang-ezhou", fromCityId: "ezhou", toCityId: "xiangyang", progress: 0.64 },
  { id: "jin-outriders", name: "大金游骑", kind: "patrol", faction: "jin", routeId: "kaifeng-xiangyang", fromCityId: "kaifeng", toCityId: "xiangyang", progress: 0.55 },
  { id: "hexi-camel", name: "河西驼队", kind: "merchant", faction: "neutral", routeId: "lingzhou-lanzhou", fromCityId: "lingzhou", toCityId: "lanzhou", progress: 0.31 },
  { id: "shunfeng-escort", name: "顺风镖行", kind: "rival", faction: "song", routeId: "fuzhou-quanzhou", fromCityId: "fuzhou", toCityId: "quanzhou", progress: 0.46 },
  { id: "jiangdong-escort", name: "江东忠义行", kind: "rival", faction: "song", routeId: "zhenjiang-jiankang", fromCityId: "zhenjiang", toCityId: "jiankang", progress: 0.28 },
  { id: "shuchuan-escort", name: "蜀川通远行", kind: "rival", faction: "song", routeId: "chengdu-lizhou", fromCityId: "chengdu", toCityId: "lizhou", progress: 0.62 },
  { id: "chuanxia-tea", name: "川峡茶帮", kind: "merchant", faction: "neutral", routeId: "chengdu-lizhou", fromCityId: "chengdu", toCityId: "lizhou", progress: 0.38 },
  { id: "dali-horse", name: "大理茶马行", kind: "merchant", faction: "dali", routeId: "dali-chengdu", fromCityId: "dali", toCityId: "chengdu", progress: 0.68 },
  { id: "song-jinghu-relief", name: "京湖制置司援军", kind: "army", faction: "song", routeId: "xiangyang-ezhou", fromCityId: "ezhou", toCityId: "xiangyang", progress: 0.34 },
  { id: "jin-southern-camp", name: "大金南京路行营", kind: "army", faction: "jin", routeId: "kaifeng-xiangyang", fromCityId: "kaifeng", toCityId: "xiangyang", progress: 0.46 },
];

export function createInitialWorldActors(): WorldActor[] {
  return INITIAL_WORLD_ACTORS.map((actor) => ({ ...actor }));
}

export function worldActorsOnRoute(actors: readonly WorldActor[] | undefined, routeId: string): WorldActor[] {
  return (actors ?? []).filter((actor) => actor.routeId === routeId);
}

export function worldActorDangerEffect(actor: WorldActor, relation = 0): number {
  if (actor.kind === "merchant") return -4;
  if (actor.kind === "rival") return 3;
  if (actor.kind === "army") return relation < 0 ? 18 : -8;
  return relation < 0 ? 9 : -5;
}

export function worldActorDangerModifier(
  actors: readonly WorldActor[] | undefined,
  routeId: string,
  relations: Partial<Record<FactionId, number>> = {},
): number {
  const modifier = worldActorsOnRoute(actors, routeId).reduce(
    (sum, actor) => sum + worldActorDangerEffect(actor, relations[actor.faction] ?? 0),
    0,
  );
  return Math.max(-10, Math.min(20, modifier));
}

export function worldActorEffectLabel(actor: WorldActor, relation = 0): string {
  if (actor.kind === "merchant") return "商旅照应 · 路险 -4";
  if (actor.kind === "rival") return "同行争道 · 路险 +3";
  if (actor.kind === "army") return relation < 0 ? "敌军压境 · 路险 +18" : "友军行营 · 路险 -8";
  return relation < 0 ? "敌境盘查 · 路险 +9" : "巡骑清道 · 路险 -5";
}

function routesAtCity(cityId: string, previousRouteId: string) {
  const all = ROUTES.filter((route) => route.from === cityId || route.to === cityId);
  const forward = all.filter((route) => route.id !== previousRouteId);
  return forward.length ? forward : all;
}

function armyRoutesAtCity(
  actor: WorldActor,
  cityId: string,
  previousRouteId: string,
  cities?: Record<string, Pick<CityState, "owner">>,
): RouteDefinition[] {
  const previous = routeById(previousRouteId);
  if (!cities) return routesAtCity(cityId, previousRouteId);
  const cityOwner = cities[cityId]?.owner;
  if (cityOwner && cityOwner !== actor.faction) return [previous];
  const candidates = ROUTES.filter((route) => route.from === cityId || route.to === cityId);
  const hostile = candidates.filter((route) => {
    const targetOwner = cities[otherCity(route, cityId)]?.owner;
    return targetOwner ? factionsAtWar(actor.faction, targetOwner) : false;
  });
  if (hostile.length) return hostile;
  const friendlyForward = candidates.filter((route) => route.id !== previousRouteId && cities[otherCity(route, cityId)]?.owner === actor.faction);
  if (friendlyForward.length) return friendlyForward;
  const friendly = candidates.filter((route) => cities[otherCity(route, cityId)]?.owner === actor.faction);
  return friendly.length ? friendly : [previous];
}

export interface WorldActorAdvanceResult {
  actors: WorldActor[];
  rngState: number;
  news: string[];
  arrivals: WorldActorArrival[];
}

export interface WorldActorArrival {
  actorId: string;
  cityId: string;
  routeId: string;
}

export function advanceWorldActors(
  actors: readonly WorldActor[],
  elapsedDays: number,
  rngState: number,
  cities?: Record<string, Pick<CityState, "owner">>,
): WorldActorAdvanceResult {
  let state = rngState;
  const news: string[] = [];
  const arrivedActors: WorldActorArrival[] = [];
  const moved = actors.map((source) => {
    let actor = { ...source, progress: Math.max(0, Math.min(0.999999, source.progress)) };
    let remainingDays = Math.max(0, elapsedDays);
    let arrivals = 0;

    while (remainingDays > 0.0001 && arrivals < 24) {
      const route = routeById(actor.routeId);
      const travelDays = route.days / ACTOR_SPEED[actor.kind];
      const daysToArrival = (1 - actor.progress) * travelDays;
      if (remainingDays < daysToArrival) {
        actor.progress = Math.min(0.999999, actor.progress + remainingDays / travelDays);
        remainingDays = 0;
        continue;
      }

      remainingDays -= daysToArrival;
      const arrivedCityId = actor.toCityId;
      arrivedActors.push({ actorId: actor.id, cityId: arrivedCityId, routeId: actor.routeId });
      const candidates = actor.kind === "army"
        ? armyRoutesAtCity(actor, arrivedCityId, actor.routeId, cities)
        : routesAtCity(arrivedCityId, actor.routeId);
      if (!candidates.length) {
        actor = { ...actor, fromCityId: actor.toCityId, toCityId: actor.fromCityId, progress: 0 };
        arrivals += 1;
        continue;
      }
      const picked = INDEPENDENT_ROUTE_ACTORS.has(actor.id)
        ? { value: candidates[independentRouteIndex(actor.id, arrivals, candidates.length)], state }
        : pickRandom(state, candidates);
      state = picked.state;
      const nextRoute = picked.value;
      actor = {
        ...actor,
        routeId: nextRoute.id,
        fromCityId: arrivedCityId,
        toCityId: otherCity(nextRoute, arrivedCityId),
        progress: 0,
      };
      arrivals += 1;
      if (news.length < 2) news.push(actor.kind === "army"
        ? `【军伍行报】${actor.name}抵达${cityById(arrivedCityId).name}，旋即转上${nextRoute.name}。`
        : `【天下行旅】${actor.name}抵达${cityById(arrivedCityId).name}，旋即转上${nextRoute.name}。`);
    }
    return actor;
  });

  return { actors: moved, rngState: state, news, arrivals: arrivedActors };
}

export function normalizeWorldActors(value: unknown): WorldActor[] {
  if (!Array.isArray(value) || value.length === 0) return createInitialWorldActors();
  const normalized = value.flatMap((item): WorldActor[] => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    if (
      typeof raw.id !== "string" || typeof raw.name !== "string" ||
      typeof raw.kind !== "string" || !ACTOR_KINDS.has(raw.kind as WorldActorKind) ||
      typeof raw.faction !== "string" || !FACTION_IDS.has(raw.faction as FactionId) ||
      typeof raw.routeId !== "string" || typeof raw.fromCityId !== "string" || typeof raw.toCityId !== "string" ||
      typeof raw.progress !== "number" || !Number.isFinite(raw.progress)
    ) return [];
    const route = ROUTES.find((candidate) => candidate.id === raw.routeId);
    if (!route || ![route.from, route.to].includes(raw.fromCityId) || ![route.from, route.to].includes(raw.toCityId) || raw.fromCityId === raw.toCityId) return [];
    return [{
      id: raw.id,
      name: raw.name,
      kind: raw.kind as WorldActorKind,
      faction: raw.faction as FactionId,
      routeId: raw.routeId,
      fromCityId: raw.fromCityId,
      toCityId: raw.toCityId,
      progress: Math.max(0, Math.min(0.999999, raw.progress)),
    }];
  });
  if (!normalized.length) return createInitialWorldActors();
  const result = [...normalized];
  for (const persistentActor of INITIAL_WORLD_ACTORS.filter((actor) => actor.kind === "army" || actor.kind === "rival")) {
    if (!result.some((actor) => actor.id === persistentActor.id)) result.push({ ...persistentActor });
  }
  return result;
}
