import { describe, expect, it } from "vitest";
import { routeById } from "../src/core/data";
import { createInitialGame, generateRoutePlans, routePlanTravelForecast, segmentTravelForecast } from "../src/core/game";
import {
  regionalWeatherSnapshot,
  weatherEffectForRoute,
  weatherForRegion,
  weatherForRoute,
  weatherForecastConfidence,
  weatherRegionForLonLat,
  weatherRoadPressure,
  weatherSeason,
  type WeatherKind,
} from "../src/core/weatherContent";

function seedForWeather(kind: WeatherKind, region: "jiangnan-coast" | "southern-coast" = "jiangnan-coast", day = 1): number {
  for (let seed = 1; seed <= 20_000; seed += 1) {
    if (weatherForRegion(seed, day, region).kind === kind) return seed;
  }
  throw new Error(`没有找到${region}的${kind}测试签`);
}

describe("区域天候与路线预报", () => {
  it("同一签数、日期与地区会给出可复现的三日天候", () => {
    const first = weatherForRegion(1208, 17, "jiangnan-coast");
    const second = weatherForRegion(1208, 17, "jiangnan-coast");
    expect(second).toEqual(first);
    expect(first.startsDay).toBeLessThanOrEqual(17);
    expect(first.endsDay).toBeGreaterThanOrEqual(17);
    expect(first.endsDay - first.startsDay).toBeLessThanOrEqual(2);
  });

  it("按经纬度把临安、广州和高原分入不同天候区", () => {
    expect(weatherRegionForLonLat(120.16, 30.25).id).toBe("jiangnan-coast");
    expect(weatherRegionForLonLat(113.27, 23.13).id).toBe("southern-coast");
    expect(weatherRegionForLonLat(91.12, 29.65).id).toBe("tibetan-plateau");
  });

  it("季节、天下天候快照与远期预报可信度均有明确规则", () => {
    expect(weatherSeason(1)).toBe("spring");
    expect(weatherSeason(90)).toBe("spring");
    expect(weatherSeason(91)).toBe("summer");
    expect(weatherSeason(181)).toBe("autumn");
    expect(weatherSeason(271)).toBe("winter");
    expect(weatherSeason(361)).toBe("spring");
    expect(regionalWeatherSnapshot(1208, 1)).toHaveLength(7);
    expect(weatherForecastConfidence(4, 4).tone).toBe("fresh");
    expect(weatherForecastConfidence(4, 8).tone).toBe("aging");
    expect(weatherForecastConfidence(4, 11).tone).toBe("rumor");
  });

  it("同一天候会按官道、山路和水路产生不同的真实代价", () => {
    const storm = weatherForRegion(seedForWeather("storm"), 1, "jiangnan-coast");
    const official = weatherEffectForRoute(storm, "official");
    const mountain = weatherEffectForRoute(storm, "mountain");
    const river = weatherEffectForRoute(storm, "river");
    expect(river.dayModifier).toBeGreaterThan(official.dayModifier);
    expect(river.dangerModifier).toBeGreaterThan(official.dangerModifier);
    expect(mountain.dangerModifier).toBeGreaterThan(official.dangerModifier);
  });

  it("连雨与雷暴会把对应道路推向可持续数日的泥泞或涨水", () => {
    const rain = weatherForRegion(seedForWeather("rain"), 1, "jiangnan-coast");
    const storm = weatherForRegion(seedForWeather("storm"), 1, "jiangnan-coast");
    expect(weatherRoadPressure(rain, "mountain")).toMatchObject({ preferredCondition: "muddy", cause: "雨软山径" });
    expect(weatherRoadPressure(rain, "river")).toMatchObject({ preferredCondition: "flooded", cause: "连雨涨水" });
    expect(weatherRoadPressure(storm, "river").incidentWeight).toBeGreaterThan(weatherRoadPressure(rain, "river").incidentWeight);
    expect(weatherRoadPressure(storm, "official").incidentWeight).toBeGreaterThan(weatherRoadPressure(rain, "official").incidentWeight);
  });

  it("单段预估使用出发日天候，多段方案按预计抵达日逐段滚动预报", () => {
    const game = createInitialGame(seedForWeather("rain"));
    const route = routeById("linan-jiankang");
    const segment = segmentTravelForecast(game, route.id);
    expect(segment.weather).toEqual(weatherForRoute(game.seed, game.day, route));
    expect(segment.weatherEffect).toEqual(weatherEffectForRoute(segment.weather, route.terrain));
    expect(segment.totalDangerModifier).toBe(segment.dangerModifier + segment.weatherDangerModifier);

    const plan = generateRoutePlans("linan", "xiangyang", game)[0];
    const forecast = routePlanTravelForecast(game, plan);
    expect(forecast.weatherReports).toHaveLength(plan.routeIds.length);
    expect(forecast.weatherReports[0].departureDay).toBe(game.day);
    expect(forecast.weatherReports.every((report, index) => index === 0 || report.departureDay > forecast.weatherReports[index - 1].departureDay)).toBe(true);
    expect(forecast.totalDangerModifier).toBe(forecast.dangerModifier + forecast.weatherDangerModifier);
    expect(forecast.weatherSummary.length).toBeGreaterThan(0);
  });
});
