import { describe, expect, it } from "vitest";
import type { CityDefinition } from "../src/core/types";
import { layoutCityMarkerClusters } from "../src/map/cityClusters";

const city = (id: string, x: number, y: number, tier: CityDefinition["tier"] = "station"): CityDefinition => ({
  id, name: id, subtitle: id, x, y, lon: x, lat: y, defaultOwner: "song", tier, description: "", specialties: [],
});

describe("city marker clustering", () => {
  const cities = [city("a", 10, 10), city("b", 20, 10, "major"), city("c", 80, 80)];

  it("merges crowded compact cities at overview scale", () => {
    const clusters = layoutCityMarkerClusters(cities, new Set(), "wide");
    expect(clusters).toHaveLength(2);
    expect(clusters.find((cluster) => cluster.cityIds.length === 2)?.primaryCityId).toBe("b");
  });

  it("never absorbs cities promoted to full markers", () => {
    const clusters = layoutCityMarkerClusters(cities, new Set(["a"]), "wide");
    expect(clusters.flatMap((cluster) => cluster.cityIds)).not.toContain("a");
  });

  it("keeps neighbouring rival factions in separate overview seals", () => {
    const owners: Record<string, string> = { a: "song", b: "jin", c: "song" };
    const clusters = layoutCityMarkerClusters(cities, new Set(), "wide", (item) => owners[item.id]);
    expect(clusters).toHaveLength(3);
    expect(clusters.every((cluster) => cluster.cityIds.length === 1)).toBe(true);
  });

  it("bounds dense chains so one overview seal never swallows a whole province", () => {
    const chain = Array.from({ length: 16 }, (_, index) => city(`chain-${index}`, index * 8, 10));
    const clusters = layoutCityMarkerClusters(chain, new Set(), "wide");
    expect(clusters.length).toBeGreaterThan(1);
    expect(Math.max(...clusters.map((cluster) => cluster.cityIds.length))).toBeLessThanOrEqual(10);
  });

  it("keeps only extremely close cities paired at the near-view scale", () => {
    const clusters = layoutCityMarkerClusters([city("near-a", 10, 10), city("near-b", 15, 10), city("far", 40, 10)], new Set(), "close");
    expect(clusters.find((cluster) => cluster.cityIds.includes("near-a"))?.cityIds).toHaveLength(2);
    expect(clusters.find((cluster) => cluster.cityIds.includes("far"))?.cityIds).toHaveLength(1);
  });

  it("keeps separated close-range cities individual and remains deterministic", () => {
    const separated = [city("a", 10, 10), city("b", 32, 10, "major"), city("c", 80, 80)];
    const forward = layoutCityMarkerClusters(separated, new Set(), "close");
    const reverse = layoutCityMarkerClusters([...separated].reverse(), new Set(), "close");
    expect(forward.every((cluster) => cluster.cityIds.length === 1)).toBe(true);
    expect(reverse).toEqual(forward);
  });
});
