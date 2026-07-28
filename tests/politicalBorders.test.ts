import { describe, expect, it } from "vitest";
import type { CityState, RouteDefinition } from "../src/core/types";
import { politicalBorderCityIds, routeCrossesPoliticalBorder, routeOwners, splitQuadraticCurve } from "../src/map/politicalBorders";

const stable = (owner: CityState["owner"]): CityState => ({
  owner,
  status: "stable",
  prosperity: 70,
  security: 70,
  intelDay: 1,
  statusSinceDay: 1,
  playerAidDay: -99,
});

const route: RouteDefinition = {
  id: "border-road",
  from: "song-city",
  to: "jin-city",
  name: "边路",
  terrain: "official",
  days: 2,
  danger: 50,
  note: "test",
};

describe("dynamic political borders", () => {
  it("derives border roads and border cities from current control rather than default history", () => {
    const cities = { "song-city": stable("song"), "jin-city": stable("jin") };
    expect(routeCrossesPoliticalBorder(cities, route)).toBe(true);
    expect(politicalBorderCityIds(cities, [route])).toEqual(new Set(["song-city", "jin-city"]));
    expect(routeOwners(cities, route)).toEqual({ from: "song", to: "jin" });

    const captured = { ...cities, "song-city": stable("jin") };
    expect(routeCrossesPoliticalBorder(captured, route)).toBe(false);
    expect(politicalBorderCityIds(captured, [route]).size).toBe(0);
  });

  it("splits a curved road at the true quadratic midpoint without a visible gap", () => {
    const split = splitQuadraticCurve({
      from: { x: 0, y: 0 },
      control: { x: 50, y: 100 },
      to: { x: 100, y: 0 },
    });
    expect(split.midpoint).toEqual({ x: 50, y: 50 });
    expect(split.fromPath.endsWith("50 50")).toBe(true);
    expect(split.toPath.startsWith("M 50 50")).toBe(true);
  });
});
