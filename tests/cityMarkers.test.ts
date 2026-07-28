import { describe, expect, it } from "vitest";
import type { CityDefinition, CityTier } from "../src/core/types";
import { detailedCityIds, nearestCityToPoint } from "../src/map/cityMarkers";

function city(id: string, x: number, y: number, tier: CityTier): CityDefinition {
  return {
    id,
    name: id,
    subtitle: id,
    x,
    y,
    lon: 0,
    lat: 0,
    defaultOwner: "song",
    tier,
    description: id,
    specialties: [],
  };
}

const cities = [
  city("capital", 100, 100, "capital"),
  city("near-major", 112, 100, "major"),
  city("far-major", 150, 100, "major"),
  city("station", 118, 100, "station"),
];

describe("progressive city markers", () => {
  it("keeps capitals and declutters nearby full-size gates in the realm view", () => {
    const visible = detailedCityIds(cities, "wide", new Set());
    expect(visible.has("capital")).toBe(true);
    expect(visible.has("near-major")).toBe(false);
    expect(visible.has("far-major")).toBe(true);
    expect(visible.has("station")).toBe(false);
  });

  it("always expands current, route, and office cities even when crowded", () => {
    const visible = detailedCityIds(cities, "wide", new Set(["near-major", "station"]));
    expect(visible.has("near-major")).toBe(true);
    expect(visible.has("station")).toBe(true);
  });

  it("reveals more detail while zooming and every city at close range", () => {
    const wide = detailedCityIds(cities, "wide", new Set());
    const mid = detailedCityIds(cities, "mid", new Set());
    const close = detailedCityIds(cities, "close", new Set());
    expect(mid.size).toBeGreaterThanOrEqual(wide.size);
    expect(close).toEqual(new Set(cities.map((item) => item.id)));
  });

  it("is deterministic regardless of input order", () => {
    expect(detailedCityIds(cities, "wide", new Set())).toEqual(detailedCityIds([...cities].reverse(), "wide", new Set()));
  });

  it("resolves overlapping hit areas to the city nearest the pointer", () => {
    expect(nearestCityToPoint(cities, { x: 113, y: 100 })?.id).toBe("near-major");
    expect(nearestCityToPoint(cities, { x: 148, y: 101 })?.id).toBe("far-major");
  });
});
