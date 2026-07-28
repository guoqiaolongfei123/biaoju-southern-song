import { describe, expect, it } from "vitest";
import { layoutSettlementMarkers } from "../src/map/settlementMarkerLayout";

describe("settlement marker layout", () => {
  it("keeps the current city at its true coordinate and fans neighbouring protected cities away", () => {
    const layout = layoutSettlementMarkers([
      { id: "current", x: 100, y: 100, radius: 8, priority: 1000, fixed: true },
      { id: "route", x: 105, y: 101, radius: 7, priority: 800 },
      { id: "office", x: 98, y: 104, radius: 7, priority: 700 },
    ], "mid");
    const current = layout.find((item) => item.id === "current")!;
    const route = layout.find((item) => item.id === "route")!;
    const office = layout.find((item) => item.id === "office")!;

    expect(current).toMatchObject({ markerX: 100, markerY: 100, displaced: false });
    expect(route.displaced).toBe(true);
    expect(office.displaced).toBe(true);
    expect(Math.hypot(route.markerX - current.markerX, route.markerY - current.markerY)).toBeGreaterThanOrEqual(16);
    expect(Math.hypot(office.markerX - current.markerX, office.markerY - current.markerY)).toBeGreaterThanOrEqual(16);
  });

  it("moves a cluster seal away from a capital but retains its geographic anchor", () => {
    const layout = layoutSettlementMarkers([
      { id: "city:capital", x: 80, y: 60, radius: 11, priority: 900 },
      { id: "cluster:nearby", x: 87, y: 61, radius: 9, priority: 200 },
    ], "wide");
    const cluster = layout.find((item) => item.id === "cluster:nearby")!;
    expect(cluster.displaced).toBe(true);
    expect(cluster.x).toBe(87);
    expect(cluster.y).toBe(61);
  });

  it("is deterministic regardless of source order", () => {
    const points = [
      { id: "a", x: 100, y: 100, radius: 8, priority: 200 },
      { id: "b", x: 104, y: 103, radius: 8, priority: 300 },
      { id: "c", x: 98, y: 105, radius: 6, priority: 100 },
    ];
    expect(layoutSettlementMarkers(points, "mid")).toEqual(layoutSettlementMarkers([...points].reverse(), "mid"));
  });
});
