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

  it("expands every city at close scale and remains deterministic", () => {
    const forward = layoutCityMarkerClusters(cities, new Set(), "close");
    const reverse = layoutCityMarkerClusters([...cities].reverse(), new Set(), "close");
    expect(forward.every((cluster) => cluster.cityIds.length === 1)).toBe(true);
    expect(reverse).toEqual(forward);
  });
});
