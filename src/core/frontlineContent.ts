import { CITIES, FACTIONS, ROUTES, cityById, otherCity } from "./data";
import { pickRandom, randomStep } from "./rng";
import type { CityState, CityStatus, FactionId, WorldActor } from "./types";

export type FrontlineRisk = "quiet" | "watch" | "siege" | "critical" | "occupied";

export interface FrontlineSituation {
  visible: boolean;
  exposed: boolean;
  risk: FrontlineRisk;
  seal: string;
  label: string;
  detail: string;
  pressure: number;
  defense: number;
  age: number;
  hostileCityIds: string[];
  hostileFactions: FactionId[];
  dominantAttacker: FactionId | null;
  attackingArmies: WorldActor[];
  reliefArmies: WorldActor[];
  nextWarning: string;
}

export interface FrontlineEvolution {
  cities: Record<string, CityState>;
  rngState: number;
  news: string[];
  changedCityId?: string;
  previousStatus?: CityStatus;
  nextStatus?: CityStatus;
  previousOwner?: FactionId;
  nextOwner?: FactionId;
}

export interface FrontlineCityAdvance {
  cityId: string;
  city: CityState;
  news: string;
  previousStatus: CityStatus;
  previousOwner: FactionId;
}

const CAMPAIGN_STATUS = new Set<CityStatus>(["tense", "martial", "besieged", "contested", "captured"]);
const HOSTILE_PAIRS = new Set(["jin:mongol", "jin:song", "jin:xixia", "mongol:xixia"]);

function factionPair(left: FactionId, right: FactionId): string {
  return [left, right].sort().join(":");
}

export function factionsAtWar(left: FactionId, right: FactionId): boolean {
  return left !== right && HOSTILE_PAIRS.has(factionPair(left, right));
}

function adjacentCityIds(cityId: string): string[] {
  return ROUTES.filter((route) => route.from === cityId || route.to === cityId).map((route) => otherCity(route, cityId));
}

function dominantFaction(ids: string[], cities: Record<string, CityState>): FactionId | null {
  const counts = new Map<FactionId, number>();
  for (const id of ids) {
    const faction = cities[id]?.owner;
    if (faction) counts.set(faction, (counts.get(faction) ?? 0) + (cityById(id).tier === "capital" ? 3 : cityById(id).tier === "major" ? 2 : 1));
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function riskPresentation(status: CityStatus, exposed: boolean, pressure: number): Pick<FrontlineSituation, "risk" | "seal" | "label"> {
  if (status === "captured") return { risk: "occupied", seal: "易", label: "新旗初定" };
  if (status === "contested") return { risk: "critical", seal: "战", label: "城垣争夺" };
  if (status === "besieged") return { risk: "siege", seal: "围", label: "烽燧合围" };
  if (!exposed) return { risk: "quiet", seal: "安", label: "腹里无警" };
  if (status === "martial" || pressure >= 46) return { risk: "siege", seal: "烽", label: "军府临战" };
  return { risk: "watch", seal: "警", label: "边声逼近" };
}

function nextWarning(status: CityStatus): string {
  if (status === "captured") return "新政权正在肃清城门；旧网点与旧路引可能失效";
  if (status === "contested") return "若城防再失，最强邻敌将换下城头旗号";
  if (status === "besieged") return "围城持续两日后可能转入两军争城";
  if (status === "tense" || status === "martial" || status === "disrupted") return "敌境压力持续时，城外将形成正式围城";
  return "战线先转为边声渐紧，不会毫无预警地直接易主";
}

export function frontlineSituation(
  cities: Record<string, CityState>,
  cityId: string,
  day: number,
  worldActors: readonly WorldActor[] = [],
): FrontlineSituation {
  const city = cities[cityId];
  if (!city) throw new Error(`Unknown city state: ${cityId}`);
  const adjacent = adjacentCityIds(cityId);
  const hostileCityIds = adjacent.filter((id) => cities[id] && factionsAtWar(city.owner, cities[id].owner));
  const approachingArmies = worldActors.filter((actor) => actor.kind === "army" && actor.toCityId === cityId && actor.progress >= .12);
  const attackingArmies = approachingArmies.filter((actor) => factionsAtWar(city.owner, actor.faction));
  const reliefArmies = approachingArmies.filter((actor) => actor.faction === city.owner);
  const hostileFactions = [...new Set([...hostileCityIds.map((id) => cities[id].owner), ...attackingArmies.map((actor) => actor.faction)])];
  const friendlyNeighbors = adjacent.filter((id) => cities[id]?.owner === city.owner).length;
  const recentlyAided = day - city.playerAidDay <= 7;
  const armyDefense = reliefArmies.reduce((sum, actor) => sum + 8 + Math.round(actor.progress * 10), 0);
  const armyPressure = attackingArmies.reduce((sum, actor) => sum + 10 + Math.round(actor.progress * 14), 0);
  const defense = Math.max(0, Math.min(100, Math.round(city.security + friendlyNeighbors * 4 + (city.prosperity >= 74 ? 4 : 0) + (recentlyAided ? 10 : 0) + armyDefense)));
  const exposed = hostileCityIds.length > 0 || attackingArmies.length > 0;
  const pressure = exposed
    ? Math.max(0, Math.min(100, Math.round(hostileCityIds.length * 22 + Math.max(0, 60 - city.security) * .45 + (city.status === "besieged" ? 10 : city.status === "contested" ? 18 : 0) - (recentlyAided ? 10 : 0) + armyPressure)))
    : 0;
  const dominantAttacker = [...attackingArmies].sort((left, right) => right.progress - left.progress)[0]?.faction ?? dominantFaction(hostileCityIds, cities);
  const presentation = riskPresentation(city.status, exposed, pressure);
  const hostileNames = hostileCityIds.slice(0, 3).map((id) => cityById(id).name).join("、");
  const attackerName = dominantAttacker ? FACTIONS[dominantAttacker].name : "敌境兵马";
  const armyReport = [
    attackingArmies.length ? `${attackingArmies.map((actor) => actor.name).join("、")}正在趋城` : "",
    reliefArmies.length ? `${reliefArmies.map((actor) => actor.name).join("、")}正在来援` : "",
  ].filter(Boolean).join("；");
  const detail = exposed
    ? `${attackerName}可由${hostileNames || "当前军道"}方向施压；${armyReport ? `${armyReport}；` : ""}守势 ${defense}，兵压 ${pressure}${recentlyAided ? "，本号援助正在稳住城防" : ""}。`
    : city.status === "captured"
      ? `城头已换旗 ${Math.max(0, day - city.statusSinceDay)} 日，关牒、网点与交割规矩仍在重定。`
      : "相邻官道暂未直通交战政权，商路仍可能受远方军情牵动。";
  return {
    ...presentation,
    visible: exposed || CAMPAIGN_STATUS.has(city.status),
    exposed,
    detail,
    pressure,
    defense,
    age: Math.max(0, day - city.statusSinceDay),
    hostileCityIds,
    hostileFactions,
    dominantAttacker,
    attackingArmies,
    reliefArmies,
    nextWarning: nextWarning(city.status),
  };
}

interface FrontlineTransition {
  status: CityStatus;
  owner: FactionId;
  securityDelta: number;
  prosperityDelta: number;
  news: string;
}

function transitionForCity(cities: Record<string, CityState>, cityId: string, day: number, worldActors: readonly WorldActor[] = []): FrontlineTransition | null {
  const city = cities[cityId];
  const situation = frontlineSituation(cities, cityId, day, worldActors);
  const cityName = cityById(cityId).name;
  if (city.status === "captured") {
    if (situation.age < 4) return null;
    return { status: "tense", owner: city.owner, securityDelta: 8, prosperityDelta: 2, news: `【${cityName}新政】换旗后的肃查渐止，城门恢复有限往来，城中仍是边声渐紧。` };
  }
  if (!situation.exposed || !situation.dominantAttacker || ["famine", "plague"].includes(city.status)) return null;
  const attacker = FACTIONS[situation.dominantAttacker].name;
  const recentAid = day - city.playerAidDay <= 7;
  if (city.status === "contested") {
    if (situation.age < 2 || recentAid || situation.pressure + 8 < situation.defense) return null;
    return { status: "captured", owner: situation.dominantAttacker, securityDelta: -12, prosperityDelta: -8, news: `【战线异动】${cityName}鏖战后易主，${attacker}已换下城头旧旗；旧关牒与当地网点随即失效。` };
  }
  if (city.status === "besieged") {
    if (situation.age < 2 || recentAid) return null;
    return { status: "contested", owner: city.owner, securityDelta: -9, prosperityDelta: -5, news: `【${cityName}争城】${attacker}逼近城垣，两军已在关门内外反复争夺；再失城防便可能换旗。` };
  }
  if (["tense", "martial", "disrupted"].includes(city.status)) {
    if (situation.age < 2 || recentAid || situation.pressure + 16 < situation.defense) return null;
    return { status: "besieged", owner: city.owner, securityDelta: -6, prosperityDelta: -4, news: `【${cityName}围城】${attacker}由${situation.hostileCityIds.slice(0, 2).map((id) => cityById(id).name).join("、")}方向合围，粮路与驿道开始断续。` };
  }
  if (["stable", "prosperous", "autonomous"].includes(city.status)) {
    return { status: "tense", owner: city.owner, securityDelta: -4, prosperityDelta: -2, news: `【${cityName}边报】${attacker}兵马已在邻路集结，城门加验关牒；若无转机，下一步将是围城。` };
  }
  return null;
}

export function advanceFrontlineCity(cities: Record<string, CityState>, cityId: string, day: number, worldActors: readonly WorldActor[] = []): FrontlineCityAdvance | null {
  const before = cities[cityId];
  if (!before) return null;
  const transition = transitionForCity(cities, cityId, day, worldActors);
  if (!transition) return null;
  return {
    cityId,
    previousStatus: before.status,
    previousOwner: before.owner,
    news: transition.news,
    city: {
      ...before,
      owner: transition.owner,
      status: transition.status,
      security: Math.max(18, Math.min(100, before.security + transition.securityDelta)),
      prosperity: Math.max(18, Math.min(100, before.prosperity + transition.prosperityDelta)),
      intelDay: day,
      statusSinceDay: transition.status === before.status ? before.statusSinceDay : day,
    },
  };
}

export function evolveFrontlineCampaign(
  sourceCities: Record<string, CityState>,
  targetDay: number,
  rngState: number,
  elapsedDays: number,
  worldActors: readonly WorldActor[] = [],
): FrontlineEvolution {
  const cities = { ...sourceCities };
  const eventRoll = randomStep(rngState);
  let state = eventRoll.state;
  if (eventRoll.value >= Math.min(.9, .1 + elapsedDays * .1)) return { cities, rngState: state, news: [] };
  const candidates = CITIES.flatMap((definition) => advanceFrontlineCity(cities, definition.id, targetDay, worldActors) ? [definition.id] : []);
  if (!candidates.length) return { cities, rngState: state, news: [] };
  const picked = pickRandom(state, candidates);
  state = picked.state;
  const cityId = picked.value;
  const advanced = advanceFrontlineCity(cities, cityId, targetDay, worldActors)!;
  const before = cities[cityId];
  const next = advanced.city;
  cities[cityId] = next;
  return {
    cities,
    rngState: state,
    news: [advanced.news],
    changedCityId: cityId,
    previousStatus: before.status,
    nextStatus: next.status,
    previousOwner: before.owner,
    nextOwner: next.owner,
  };
}
