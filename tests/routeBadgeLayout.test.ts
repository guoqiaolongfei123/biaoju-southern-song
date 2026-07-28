import { describe, expect, it } from "vitest";
import { layoutRouteBadges } from "../src/map/routeBadgeLayout";

describe("route badge layout", () => {
  it("keeps the highest priority seal on the route and fans the rest away", () => {
    const layout = layoutRouteBadges([
      { id: "border", x: 100, y: 100, radius: 7, priority: 900 },
      { id: "condition", x: 100, y: 100, radius: 6, priority: 800 },
      { id: "terrain", x: 100, y: 100, radius: 5, priority: 100 },
    ], [], "mid");
    const border = layout.find((item) => item.id === "border")!;
    const condition = layout.find((item) => item.id === "condition")!;
    const terrain = layout.find((item) => item.id === "terrain")!;
    expect(border).toMatchObject({ markerX: 100, markerY: 100, displaced: false });
    expect(condition.displaced).toBe(true);
    expect(terrain.displaced).toBe(true);
    expect(Math.hypot(condition.markerX - border.markerX, condition.markerY - border.markerY)).toBeGreaterThan(10);
  });

  it("avoids city markers and remains deterministic", () => {
    const points = [{ id: "border", x: 80, y: 60, radius: 7, priority: 900 }];
    const obstacles = [{ id: "city", x: 80, y: 60, radius: 12 }];
    const forward = layoutRouteBadges(points, obstacles, "wide");
    const repeat = layoutRouteBadges(points, obstacles, "wide");
    expect(forward).toEqual(repeat);
    expect(forward[0].displaced).toBe(true);
    expect(Math.hypot(forward[0].markerX - 80, forward[0].markerY - 60)).toBeGreaterThan(0);
  });

  it("fans candidate route seals around a crowded waypoint instead of stacking them", () => {
    const radius = 5.4;
    const layout = layoutRouteBadges([
      { id: "route-candidate:fast", x: 100, y: 100, radius, priority: 1260 },
      { id: "route-candidate:steady", x: 103, y: 101, radius, priority: 1219 },
      { id: "route-candidate:wide", x: 101, y: 104, radius, priority: 1218 },
    ], [{ id: "city", x: 100, y: 100, radius: 8 }], "close");
    expect(layout.every((item) => item.displaced)).toBe(true);
    for (let first = 0; first < layout.length; first += 1) {
      for (let second = first + 1; second < layout.length; second += 1) {
        expect(Math.hypot(
          layout[first].markerX - layout[second].markerX,
          layout[first].markerY - layout[second].markerY,
        )).toBeGreaterThanOrEqual(radius * 2);
      }
    }
  });
});
