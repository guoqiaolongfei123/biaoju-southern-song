import { cityById } from "./data";
import type { CityDefinition, RouteCondition, RouteDefinition, RouteTerrain } from "./types";

export type WeatherKind = "clear" | "rain" | "storm" | "fog" | "gale" | "frost" | "heat";
export type WeatherRegionId = "tibetan-plateau" | "northwest" | "northern-plains" | "sichuan-basin" | "middle-yangtze" | "jiangnan-coast" | "southern-coast";
export type WeatherSeason = "spring" | "summer" | "autumn" | "winter";

export interface WeatherRegion {
  id: WeatherRegionId;
  name: string;
  center: [number, number];
  phase: number;
  weights: Partial<Record<WeatherKind, number>>;
}

export interface RegionalWeather {
  region: WeatherRegion;
  kind: WeatherKind;
  label: string;
  seal: string;
  description: string;
  severity: number;
  startsDay: number;
  endsDay: number;
  season: WeatherSeason;
}

export interface RouteWeatherEffect {
  dayModifier: number;
  dangerModifier: number;
  staminaMultiplier: number;
  eventChanceModifier: number;
  note: string;
}

export interface WeatherForecastConfidence {
  label: string;
  tone: "fresh" | "aging" | "rumor";
}

export interface WeatherRoadPressure {
  /** Relative chance that this route is selected when a new road incident forms. */
  incidentWeight: number;
  /** The persistent road condition most naturally caused by this weather. */
  preferredCondition: Extract<RouteCondition, "muddy" | "flooded"> | null;
  cause: string | null;
  durationModifier: number;
}

const WEATHER = {
  clear: { label: "天光澄明", seal: "晴", description: "云脚高，风势平，车马可照常赶程。", severity: 0 },
  rain: { label: "连日细雨", seal: "雨", description: "雨脚不断，土路发软，车轮与马蹄都更费力。", severity: 2 },
  storm: { label: "急雨雷暴", seal: "暴", description: "风雨骤急，渡船与山口最容易误程。", severity: 4 },
  fog: { label: "晨昏重雾", seal: "雾", description: "远近难辨，趟子手与哨骑都更难看清前路。", severity: 2 },
  gale: { label: "大风卷尘", seal: "风", description: "逆风压车，河面与高地行路尤其不稳。", severity: 3 },
  frost: { label: "霜雪封寒", seal: "霜", description: "石路结滑，草料受冻，北地与高原行程转慢。", severity: 3 },
  heat: { label: "暑气蒸郁", seal: "暑", description: "人马失水更快，午后不宜长途催行。", severity: 2 },
} satisfies Record<WeatherKind, { label: string; seal: string; description: string; severity: number }>;

export const WEATHER_REGIONS: readonly WeatherRegion[] = [
  { id: "tibetan-plateau", name: "雪域高原", center: [91.2, 31.4], phase: 0, weights: { clear: 24, gale: 20, frost: 24, fog: 4, rain: 5 } },
  { id: "northwest", name: "陇右河西", center: [102.1, 36.4], phase: 1, weights: { clear: 30, gale: 20, frost: 16, fog: 4, rain: 7 } },
  { id: "northern-plains", name: "河朔中原", center: [114.6, 37.2], phase: 2, weights: { clear: 24, gale: 14, frost: 14, fog: 10, rain: 10, storm: 3 } },
  { id: "sichuan-basin", name: "巴蜀盆地", center: [104.4, 30.4], phase: 0, weights: { clear: 14, rain: 22, storm: 6, fog: 22, heat: 6 } },
  { id: "middle-yangtze", name: "荆湖淮汉", center: [112.6, 30.4], phase: 1, weights: { clear: 16, rain: 22, storm: 9, fog: 13, heat: 7, gale: 4 } },
  { id: "jiangnan-coast", name: "江南两浙", center: [120.1, 29.1], phase: 2, weights: { clear: 14, rain: 25, storm: 10, fog: 13, heat: 7, gale: 5 } },
  { id: "southern-coast", name: "岭南海疆", center: [113.2, 23.3], phase: 0, weights: { clear: 16, rain: 19, storm: 16, fog: 6, heat: 18, gale: 6 } },
] as const;

const REGIONS_BY_ID = Object.fromEntries(WEATHER_REGIONS.map((region) => [region.id, region])) as Record<WeatherRegionId, WeatherRegion>;

const SEASON_WEIGHTS: Record<WeatherSeason, Partial<Record<WeatherKind, number>>> = {
  spring: { rain: 9, fog: 8, storm: 2, clear: 2 },
  summer: { rain: 7, storm: 12, heat: 12, frost: -20 },
  autumn: { clear: 12, gale: 7, fog: 4, heat: -4 },
  winter: { frost: 20, gale: 8, clear: 7, heat: -20, storm: -6 },
};

const WEATHER_KINDS = Object.keys(WEATHER) as WeatherKind[];

function hashUnit(seed: number, period: number, salt: string): number {
  let value = (seed >>> 0) ^ Math.imul(period + 1, 0x9e3779b1);
  for (let index = 0; index < salt.length; index += 1) {
    value ^= salt.charCodeAt(index);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  }
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

export function weatherSeason(day: number): WeatherSeason {
  const seasonDay = ((Math.max(1, Math.floor(day)) - 1) % 360) + 1;
  if (seasonDay <= 90) return "spring";
  if (seasonDay <= 180) return "summer";
  if (seasonDay <= 270) return "autumn";
  return "winter";
}

export function weatherRegionForLonLat(lon: number, lat: number): WeatherRegion {
  if (lon < 98) return REGIONS_BY_ID["tibetan-plateau"];
  if (lat >= 33 && lon < 108) return REGIONS_BY_ID.northwest;
  if (lat >= 33) return REGIONS_BY_ID["northern-plains"];
  if (lon < 108 && lat >= 27) return REGIONS_BY_ID["sichuan-basin"];
  if (lat >= 27 && lon < 117) return REGIONS_BY_ID["middle-yangtze"];
  if (lat >= 25) return REGIONS_BY_ID["jiangnan-coast"];
  return REGIONS_BY_ID["southern-coast"];
}

export function weatherForRegion(seed: number, day: number, regionId: WeatherRegionId): RegionalWeather {
  const region = REGIONS_BY_ID[regionId];
  const safeDay = Math.max(1, Math.floor(day));
  const shiftedDay = safeDay + region.phase;
  const spellIndex = Math.floor((shiftedDay - 1) / 3);
  const rawStartsDay = spellIndex * 3 + 1 - region.phase;
  const startsDay = Math.max(1, rawStartsDay);
  const season = weatherSeason(safeDay);
  const weights = WEATHER_KINDS.map((kind) => Math.max(0, (region.weights[kind] ?? 0) + (SEASON_WEIGHTS[season][kind] ?? 0)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let pick = hashUnit(seed, spellIndex, region.id) * total;
  let kind: WeatherKind = "clear";
  for (let index = 0; index < WEATHER_KINDS.length; index += 1) {
    pick -= weights[index];
    if (pick <= 0) {
      kind = WEATHER_KINDS[index];
      break;
    }
  }
  const definition = WEATHER[kind];
  return {
    region,
    kind,
    ...definition,
    startsDay,
    endsDay: Math.max(startsDay, rawStartsDay + 2),
    season,
  };
}

export function weatherForCity(seed: number, day: number, city: CityDefinition): RegionalWeather {
  return weatherForRegion(seed, day, weatherRegionForLonLat(city.lon, city.lat).id);
}

export function weatherForRoute(seed: number, day: number, route: RouteDefinition): RegionalWeather {
  const from = cityById(route.from);
  const to = cityById(route.to);
  return weatherForRegion(seed, day, weatherRegionForLonLat((from.lon + to.lon) / 2, (from.lat + to.lat) / 2).id);
}

export function weatherEffectForRoute(weather: RegionalWeather, terrain: RouteTerrain): RouteWeatherEffect {
  if (weather.kind === "clear") return { dayModifier: 0, dangerModifier: 0, staminaMultiplier: 1, eventChanceModifier: -0.04, note: "天候平稳" };
  if (weather.kind === "rain") return {
    dayModifier: terrain === "river" ? 0 : 1,
    dangerModifier: terrain === "mountain" ? 7 : 4,
    staminaMultiplier: terrain === "mountain" ? 1.14 : 1.09,
    eventChanceModifier: 0.1,
    note: terrain === "river" ? "雨涨水急" : "雨软车辙",
  };
  if (weather.kind === "storm") return {
    dayModifier: terrain === "river" ? 2 : 1,
    dangerModifier: terrain === "river" ? 15 : terrain === "mountain" ? 12 : 9,
    staminaMultiplier: terrain === "river" ? 1.16 : 1.2,
    eventChanceModifier: 0.24,
    note: terrain === "river" ? "风急停渡" : "暴雨误程",
  };
  if (weather.kind === "fog") return {
    dayModifier: terrain === "official" ? 0 : 1,
    dangerModifier: terrain === "official" ? 4 : 8,
    staminaMultiplier: 1.05,
    eventChanceModifier: 0.03,
    note: "雾中难辨哨路",
  };
  if (weather.kind === "gale") return {
    dayModifier: terrain === "river" ? 2 : terrain === "mountain" ? 1 : 0,
    dangerModifier: terrain === "river" ? 13 : terrain === "mountain" ? 9 : 5,
    staminaMultiplier: terrain === "official" ? 1.06 : 1.14,
    eventChanceModifier: terrain === "river" ? 0.16 : 0.06,
    note: terrain === "river" ? "逆风压船" : "风卷行尘",
  };
  if (weather.kind === "frost") return {
    dayModifier: 1,
    dangerModifier: terrain === "mountain" ? 10 : 7,
    staminaMultiplier: terrain === "mountain" ? 1.18 : 1.12,
    eventChanceModifier: 0.06,
    note: "霜滑草冻",
  };
  return {
    dayModifier: 0,
    dangerModifier: terrain === "mountain" ? 5 : 3,
    staminaMultiplier: 1.14,
    eventChanceModifier: 0.04,
    note: "暑热耗马",
  };
}

/**
 * Convert a short weather spell into pressure on the persistent road network.
 * Travel forecasts already price today's rain into a single segment; this
 * second layer answers whether several wet days leave a road muddy or a ferry
 * flooded after the sky clears.
 */
export function weatherRoadPressure(weather: RegionalWeather, terrain: RouteTerrain): WeatherRoadPressure {
  if (weather.kind === "storm") {
    if (terrain === "river") return { incidentWeight: 10, preferredCondition: "flooded", cause: "急雨涨水", durationModifier: 1 };
    return { incidentWeight: terrain === "mountain" ? 9 : 7, preferredCondition: "muddy", cause: terrain === "mountain" ? "暴雨冲坡" : "暴雨坏路", durationModifier: 1 };
  }
  if (weather.kind === "rain") {
    if (terrain === "river") return { incidentWeight: 7, preferredCondition: "flooded", cause: "连雨涨水", durationModifier: 1 };
    return { incidentWeight: terrain === "mountain" ? 6 : 4, preferredCondition: "muddy", cause: terrain === "mountain" ? "雨软山径" : "雨软车辙", durationModifier: 0 };
  }
  if (weather.kind === "frost") return { incidentWeight: terrain === "mountain" ? 4 : 2, preferredCondition: null, cause: "霜冻伤路", durationModifier: 0 };
  if (weather.kind === "gale") return { incidentWeight: terrain === "river" ? 3 : 2, preferredCondition: null, cause: "大风阻路", durationModifier: 0 };
  if (weather.kind === "fog") return { incidentWeight: 2, preferredCondition: null, cause: null, durationModifier: 0 };
  return { incidentWeight: 1, preferredCondition: null, cause: null, durationModifier: 0 };
}

export function weatherForecastConfidence(currentDay: number, forecastDay: number): WeatherForecastConfidence {
  const distance = Math.max(0, forecastDay - currentDay);
  if (distance === 0) return { label: "今日天象", tone: "fresh" };
  if (distance <= 2) return { label: "近日报 · 可据", tone: "fresh" };
  if (distance <= 5) return { label: "远日报 · 或有变", tone: "aging" };
  return { label: "天候传闻", tone: "rumor" };
}

export function regionalWeatherSnapshot(seed: number, day: number): RegionalWeather[] {
  return WEATHER_REGIONS.map((region) => weatherForRegion(seed, day, region.id));
}

export function weatherSequenceSummary(weather: readonly RegionalWeather[]): string {
  const significant = weather.filter((item) => item.kind !== "clear");
  if (!significant.length) return "沿途天候平稳";
  const unique = [...new Map(significant.map((item) => [item.kind, item])).values()]
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 2);
  return unique.map((item) => `${item.seal}·${item.label}`).join("／");
}
