import { describe, expect, it } from "vitest";
import { layoutWeatherMarkers } from "../src/map/weatherMarkerLayout";

describe("weather marker layout", () => {
  it("moves a cartouche away from city architecture while preserving its anchor", () => {
    const [layout] = layoutWeatherMarkers(
      [{ id: "jiangnan", x: 100, y: 100 }],
      [{ id: "city", x: 100, y: 100, radius: 18 }],
      "wide",
    );
    expect(Math.hypot(layout.markerX - 100, layout.markerY - 100)).toBeGreaterThan(0);
    expect(layout.x).toBe(100);
    expect(layout.y).toBe(100);
  });

  it("keeps a free preferred position and is deterministic", () => {
    const points = [{ id: "north", x: 20, y: 20, offsetX: 12, offsetY: -4 }];
    expect(layoutWeatherMarkers(points, [], "mid")).toEqual(layoutWeatherMarkers(points, [], "mid"));
    expect(layoutWeatherMarkers(points, [], "mid")[0]).toMatchObject({ markerX: 32, markerY: 16 });
  });

  it("keeps full weather labels clear of route seals and neighbouring weather", () => {
    const obstacle = { id: "route-candidate", x: 100, y: 100, radius: 6 };
    const layout = layoutWeatherMarkers([
      { id: "jiangnan", x: 100, y: 100 },
      { id: "middle-yangtze", x: 104, y: 102 },
    ], [obstacle], "close");
    for (const item of layout) {
      expect(Math.hypot(item.markerX - obstacle.x, item.markerY - obstacle.y)).toBeGreaterThanOrEqual(item.radius + obstacle.radius);
    }
    expect(Math.hypot(
      layout[0].markerX - layout[1].markerX,
      layout[0].markerY - layout[1].markerY,
    )).toBeGreaterThanOrEqual(layout[0].radius + layout[1].radius);
  });
});
