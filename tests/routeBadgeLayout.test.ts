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
});
