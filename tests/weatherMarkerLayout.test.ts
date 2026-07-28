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
});
