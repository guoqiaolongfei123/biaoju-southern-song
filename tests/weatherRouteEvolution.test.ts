import { describe, expect, it } from "vitest";
import { ROUTES, routeById } from "../src/core/data";
import { createInitialGame, evolveRouteConditions } from "../src/core/game";
import { weatherForRoute } from "../src/core/weatherContent";

function seedForRouteWeather(routeId: string, day: number, kind: "rain" | "storm"): number {
  const route = routeById(routeId);
  for (let seed = 1; seed <= 30_000; seed += 1) {
    if (weatherForRoute(seed, day, route).kind === kind) return seed;
  }
  throw new Error(`没有找到${route.name}的${kind}测试签`);
}

describe("天候驱动的道路演化", () => {
  it("暴雨会把唯一可演化的水路确定性推成涨水路况，并写明天气成因", () => {
    const base = createInitialGame(1107);
    const route = routeById("linan-shaoxing");
    const targetDay = 91;
    const stormSeed = seedForRouteWeather(route.id, targetDay, "storm");
    const isolatedStates = Object.fromEntries(ROUTES.map((candidate) => [candidate.id, candidate.id === route.id
      ? { ...base.routeStates[candidate.id], condition: "clear" as const, clearsDay: null }
      : { ...base.routeStates[candidate.id], condition: "banditry" as const, clearsDay: 999 }]));

    const evolved = evolveRouteConditions(isolatedStates, base.cities, targetDay, 1, 20, new Set(), stormSeed);
    expect(evolved.routeStates[route.id].condition).toBe("flooded");
    expect(evolved.routeStates[route.id].clearsDay).toBeGreaterThanOrEqual(targetDay + 4);
    expect(evolved.news[0]).toContain("急雨雷暴");
    expect(evolved.news[0]).toContain("急雨涨水");
    expect(evolveRouteConditions(isolatedStates, base.cities, targetDay, 1, 20, new Set(), stormSeed)).toEqual(evolved);
  });

  it("当前正在行驶的路段仍不会在脚下突然生成新异状", () => {
    const base = createInitialGame(1107);
    const route = routeById("linan-shaoxing");
    const targetDay = 91;
    const stormSeed = seedForRouteWeather(route.id, targetDay, "storm");
    const isolatedStates = Object.fromEntries(ROUTES.map((candidate) => [candidate.id, candidate.id === route.id
      ? { ...base.routeStates[candidate.id], condition: "clear" as const, clearsDay: null }
      : { ...base.routeStates[candidate.id], condition: "banditry" as const, clearsDay: 999 }]));

    const evolved = evolveRouteConditions(isolatedStates, base.cities, targetDay, 1, 20, new Set([route.id]), stormSeed);
    expect(evolved.routeStates[route.id].condition).toBe("clear");
    expect(evolved.news).toHaveLength(0);
  });
});
