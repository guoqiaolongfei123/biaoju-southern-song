import { describe, expect, it } from "vitest";
import type { CityDefinition, CityTier } from "../src/core/types";
import { cityLabelBounds, layoutCityLabels } from "../src/map/cityLabels";

function city(id: string, name: string, x: number, y: number, tier: CityTier = "major"): CityDefinition {
  return {
    id,
    name,
    subtitle: name,
    x,
    y,
    lon: 0,
    lat: 0,
    defaultOwner: "song",
    tier,
    description: name,
    specialties: [],
  };
}

function overlaps(a: ReturnType<typeof cityLabelBounds>, b: ReturnType<typeof cityLabelBounds>): boolean {
  return a.left < b.right + 1.2 && a.right > b.left - 1.2 && a.top < b.bottom + 1.2 && a.bottom > b.top - 1.2;
}

describe("city label decluttering", () => {
  it("uses the second ring of placements for crowded pinned route cities", () => {
    const cities = [
      city("current", "临安府", 120, 120),
      city("stop-one", "嘉兴府", 127, 120),
      city("stop-two", "平江府", 120, 127),
      city("office", "湖州", 127, 127),
    ];
    const pinned = new Set(cities.map((item) => item.id));
    const layout = layoutCityLabels(cities, { x: 40, y: 40, width: 220, height: 160 }, "mid", pinned);
    expect(cities.every((item) => layout[item.id].visible)).toBe(true);
    const boxes = cities.map((item) => cityLabelBounds(item, layout[item.id], "mid"));
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        expect(overlaps(boxes[first], boxes[second])).toBe(false);
      }
    }
  });

  it("still hides optional station labels in the realm view", () => {
    const station = city("station", "小驿", 100, 100, "station");
    const layout = layoutCityLabels([station], { x: 0, y: 0, width: 200, height: 150 }, "wide", new Set());
    expect(layout.station.visible).toBe(false);
  });

  it("routes pinned labels around weather, road-state and traveler overlays", () => {
    const current = city("current", "临安府", 120, 120);
    const firstCandidateObstacle = [{ id: "weather", x: 120, y: 142, radius: 14 }];
    const layout = layoutCityLabels(
      [current],
      { x: 40, y: 40, width: 220, height: 160 },
      "mid",
      new Set([current.id]),
      [current],
      new Set([current.id]),
      firstCandidateObstacle,
    );
    const label = cityLabelBounds(current, layout.current, "mid");
    const obstacle = { left: 106, right: 134, top: 128, bottom: 156 };
    expect(layout.current.visible).toBe(true);
    expect(overlaps(label, obstacle)).toBe(false);
  });

  it("uses long leader positions for a dense close-view itinerary", () => {
    const cities = [
      city("linan", "临安府", 100, 100),
      city("shaoxing", "绍兴府", 105, 99),
      city("qingyuan", "庆元府", 109, 104),
      city("taizhou", "台州", 103, 108),
      city("jiaxing", "嘉兴府", 97, 105),
      city("huzhou", "湖州", 101, 102),
      city("pingjiang", "平江府", 106, 106),
      city("zhenjiang", "镇江府", 99, 107),
    ];
    const layout = layoutCityLabels(
      cities,
      { x: 35, y: 35, width: 150, height: 140 },
      "close",
      new Set(cities.map((item) => item.id)),
    );
    expect(cities.every((item) => layout[item.id].visible)).toBe(true);
    const boxes = cities.map((item) => cityLabelBounds(item, layout[item.id], "close"));
    for (let first = 0; first < boxes.length; first += 1) {
      for (let second = first + 1; second < boxes.length; second += 1) {
        expect(overlaps(boxes[first], boxes[second])).toBe(false);
      }
    }
    expect(cities.some((item) => Math.abs(layout[item.id].x) > 30 || Math.abs(layout[item.id].y) > 30)).toBe(true);
  });
});
